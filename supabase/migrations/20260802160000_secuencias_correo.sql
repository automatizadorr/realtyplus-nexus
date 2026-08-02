-- =====================================================================
-- SECUENCIAS DE CORREOS (embudo con guías gratuitas)
-- ---------------------------------------------------------------------
-- Flujo: el usuario elige una plantilla de secuencia (3 o 5 correos) y
-- programa un envío con fecha de inicio. `programar-secuencia` (edge)
-- crea una fila en secuencia_envios_programados POR contacto y POR paso
-- con la hora calculada (fecha_inicio + días, en la hora local elegida).
-- El cron `cron-secuencias-correo` (cada 15 min) envía los que vencen
-- vía Resend, los registra en correo_envios y marca el estado.
-- RLS: admins leen; las escrituras las hacen las edges (service_role).
-- =====================================================================

-- ---------- 1) Plantillas de secuencia (3 y 5 correos) ----------
CREATE TABLE IF NOT EXISTS public.secuencias_correo (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        text NOT NULL,
  descripcion   text,
  total_pasos   int  NOT NULL CHECK (total_pasos BETWEEN 1 AND 6),
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.secuencias_correo IS
  'Plantillas de secuencias de correos (embudos). Cada paso regala una guía del embudo.';

CREATE TABLE IF NOT EXISTS public.secuencias_correo_pasos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  secuencia_id   uuid NOT NULL REFERENCES public.secuencias_correo(id) ON DELETE CASCADE,
  paso           int  NOT NULL,
  dias_desde_inicio int NOT NULL DEFAULT 0,   -- 0 = mismo día del primer envío
  hora_envio     text NOT NULL,               -- "HH:MM" (hora local de Chile)
  asunto         text NOT NULL,
  cuerpo         text NOT NULL,               -- con {{empresa}}/{{ciudad}}/{{gancho}}
  cta_texto      text,                        -- botón del correo (guía gratis)
  cta_url        text,
  guia_titulo    text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (secuencia_id, paso)
);

COMMENT ON TABLE public.secuencias_correo_pasos IS
  'Pasos de cada secuencia: cuántos días después se envía, a qué hora, asunto, cuerpo y guía regalada.';

-- ---------- 2) Envíos programados (snapshot por contacto × paso) ----------
CREATE TABLE IF NOT EXISTS public.secuencia_envios_programados (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  secuencia_id     uuid REFERENCES public.secuencias_correo(id) ON DELETE SET NULL,
  secuencia_nombre text,                     -- snapshot del nombre al programar

  email            text NOT NULL,
  empresa          text,
  ciudad           text,
  gancho           text,

  paso             int NOT NULL,
  asunto           text NOT NULL,            -- snapshot (si se edita la plantilla, no cambia lo ya agendado)
  cuerpo           text NOT NULL,
  cta_texto        text,
  cta_url          text,

  from_name        text NOT NULL DEFAULT 'Mario · LexHouse',
  from_email       text NOT NULL DEFAULT 'no-reply@send.lexhouse-ai.com',
  reply_to         text,

  enviar_en        timestamptz NOT NULL,     -- momento exacto del envío (UTC)
  estado           text NOT NULL DEFAULT 'pendiente'
                     CHECK (estado IN ('pendiente','enviado','fallido','cancelado')),
  enviado_at       timestamptz,
  error            text,
  resend_id        text,

  creado_por       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sec_prog_pendiente  ON public.secuencia_envios_programados (estado, enviar_en);
CREATE INDEX IF NOT EXISTS idx_sec_prog_email      ON public.secuencia_envios_programados (lower(email));
CREATE INDEX IF NOT EXISTS idx_sec_prog_created    ON public.secuencia_envios_programados (created_at DESC);

COMMENT ON TABLE public.secuencia_envios_programados IS
  'Envíos agendados de secuencias: una fila por contacto y por paso, con el contenido congelado al momento de programar.';

-- ---------- 3) El log de seguimiento sabe de qué secuencia vino ----------
ALTER TABLE public.correo_envios
  ADD COLUMN IF NOT EXISTS secuencia_nombre text,
  ADD COLUMN IF NOT EXISTS secuencia_paso    int;

-- ---------- 4) RLS ----------
ALTER TABLE public.secuencias_correo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secuencias_correo_pasos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secuencia_envios_programados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read secuencias_correo" ON public.secuencias_correo;
CREATE POLICY "Admins read secuencias_correo"
  ON public.secuencias_correo FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins read secuencias_correo_pasos" ON public.secuencias_correo_pasos;
CREATE POLICY "Admins read secuencias_correo_pasos"
  ON public.secuencias_correo_pasos FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins read secuencia_envios_programados" ON public.secuencia_envios_programados;
CREATE POLICY "Admins read secuencia_envios_programados"
  ON public.secuencia_envios_programados FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- (Sin políticas INSERT/UPDATE/DELETE: solo service_role, que ignora RLS.)

-- ---------- 5) Seeds: embudo de 3 correos ----------
INSERT INTO public.secuencias_correo (id, nombre, descripcion, total_pasos) VALUES
  ('a1111111-0000-4000-8000-000000000003',
   'Embudo 3 correos · Guías',
   '7 días, una guía gratis por correo: WhatsApp, Reels y autodiagnóstico.',
   3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.secuencias_correo_pasos
  (secuencia_id, paso, dias_desde_inicio, hora_envio, asunto, cuerpo, cta_texto, cta_url, guia_titulo)
VALUES
  ('a1111111-0000-4000-8000-000000000003', 1, 0, '09:00',
   '{{empresa}}: 12 mensajes para no perder ni un lead más',
$$Hola equipo de {{empresa}},

Trabajamos con corredoras en Chile y hay algo que vemos una y otra vez: {{gancho}}.

Te dejo de regalo una guía corta y práctica con 12 mensajes de WhatsApp listos para copiar y pegar, qué decir cuando el cliente "lo va a pensar" y el truco de una sola pregunta que dispara las respuestas.

Descárgala gratis aquí abajo 👇

Un saludo,
Mario · LexHouse$$,
   'Descargar la guía gratis', 'https://lexhouse-ai.homes/regalos/guia-whatsapp-inmobiliario.html',
   'Guía WhatsApp: 12 mensajes que convierten'),
  ('a1111111-0000-4000-8000-000000000003', 2, 3, '09:00',
   '{{empresa}}: que tus propiedades dejen de pasar desapercibidas',
$$Hola de nuevo, {{empresa}},

¿Aplicaste los 12 mensajes? Ahora te toca la otra mitad: que te encuentren.

Te regalo esta guía con 10 ganchos para los primeros 2 segundos de un reel y la estructura exacta de un video de 15 segundos que convierte en consultas.

Sin vueltas, es tuya aquí 👇

Un saludo,
Mario · LexHouse$$,
   'Descargar los 10 ganchos', 'https://lexhouse-ai.homes/regalos/guia-reels-inmobiliarios.html',
   'Guía Reels: 10 ganchos + estructura'),
  ('a1111111-0000-4000-8000-000000000003', 3, 7, '09:00',
   '{{empresa}}: ¿cuántos leads pierdes al mes? (2 min)',
$$Hola {{empresa}},

Último regalo por hoy, y es el que más revela: un autodiagnóstico de 2 minutos que te dice cuántos leads se te escapan y por dónde.

La mayoría de las corredoras que lo hacen descubren al menos 3 fugas que no veían. Hazlo aquí abajo 👇

Si quieres, responde este correo y te mostramos cómo se vería resuelto.

Un saludo,
Mario · LexHouse$$,
   'Hacer el autodiagnóstico', 'https://lexhouse-ai.homes/regalos/autodiagnostico-corredora.html',
   'Autodiagnóstico de corredora (2 min)');

-- ---------- 6) Seeds: embudo de 5 correos ----------
INSERT INTO public.secuencias_correo (id, nombre, descripcion, total_pasos) VALUES
  ('a1111111-0000-4000-8000-000000000005',
   'Embudo 5 correos · Guías',
   '14 días: autodiagnóstico, WhatsApp, anti-fuga, Reels y agendamiento de demo.',
   5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.secuencias_correo_pasos
  (secuencia_id, paso, dias_desde_inicio, hora_envio, asunto, cuerpo, cta_texto, cta_url, guia_titulo)
VALUES
  ('a1111111-0000-4000-8000-000000000005', 1, 0, '09:00',
   '{{empresa}}: 2 minutos para saber cuántos leads pierdes',
$$Hola equipo de {{empresa}},

Empezamos sin venderte nada: un autodiagnóstico de 2 minutos que mide cuántos leads se te escapan al mes y por dónde.

Es gratis y revelador. Hazlo aquí 👇

Un saludo,
Mario · LexHouse$$,
   'Hacer el autodiagnóstico', 'https://lexhouse-ai.homes/regalos/autodiagnostico-corredora.html',
   'Autodiagnóstico de corredora (2 min)'),
  ('a1111111-0000-4000-8000-000000000005', 2, 2, '09:00',
   '{{empresa}}: 12 mensajes para no perder ni un lead más',
$$Hola {{empresa}},

¿Qué te dijo el autodiagnóstico? Si encontraste la fuga típica (el lead escribe y nadie responde a tiempo), esta guía es tuya:

12 mensajes de WhatsApp listos para copiar y pegar, con qué decir en el primer contacto, en el seguimiento y cuando "lo va a pensar".

Descárgala aquí 👇

Un saludo,
Mario · LexHouse$$,
   'Descargar la guía gratis', 'https://lexhouse-ai.homes/regalos/guia-whatsapp-inmobiliario.html',
   'Guía WhatsApp: 12 mensajes que convierten'),
  ('a1111111-0000-4000-8000-000000000005', 3, 5, '09:00',
   '{{empresa}}: el sistema anti-fuga que usan las corredoras top',
$$Hola {{empresa}},

Si el autodiagnóstico te incomodó, esta es la guía que necesitas: el sistema anti-fuga de leads que usan las corredoras que nunca se quedan sin consultas.

Te la regalo aquí 👇

Un saludo,
Mario · LexHouse$$,
   'Descargar el sistema anti-fuga', 'https://lexhouse-ai.homes/regalos/sistema-anti-fuga-leads.html',
   'Sistema anti-fuga de leads'),
  ('a1111111-0000-4000-8000-000000000005', 4, 9, '09:00',
   '{{empresa}}: que tus propiedades dejen de pasar desapercibidas',
$$Hola {{empresa}},

Las corredoras que aparecen primero en la mente de un comprador no son las que más propiedades tienen: son las que más se ven.

Te dejo de regalo 10 ganchos para los primeros 2 segundos de un reel y la estructura exacta de un video de 15 segundos que trae consultas. Es tuya aquí 👇

Un saludo,
Mario · LexHouse$$,
   'Descargar los 10 ganchos', 'https://lexhouse-ai.homes/regalos/guia-reels-inmobiliarios.html',
   'Guía Reels: 10 ganchos + estructura'),
  ('a1111111-0000-4000-8000-000000000005', 5, 14, '09:00',
   '{{empresa}}: ya tienes el método. Falta verlo en tu corredora',
$$Hola {{empresa}},

Durante estas 2 semanas te dejamos el método completo: mensajes, video y sistema anti-fuga. Lo último que falta es verlo aplicado a {{ciudad}}.

Te dejo este checklist de 5 preguntas para llegar con todo claro a la demo, y si quieres, agendamos 20 minutos y te mostramos cómo se vería en {{empresa}}.

Agenda aquí 👇

Un saludo,
Mario · LexHouse$$,
   'Agendar mi demo', 'https://lexhouse-ai.homes/regalos/checklist-antes-de-tu-reunion.html',
   'Checklist antes de tu reunión');

-- =====================================================================
-- CRON: cron-secuencias-correo (envía los correos vencidos cada 15 min)
-- ---------------------------------------------------------------------
-- Ejecuta este bloque APARTE en el SQL Editor con tu secreto real.
-- NO se versiona con el secreto. Requiere extensiones pg_cron y pg_net.
-- ---------------------------------------------------------------------
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
--
-- select cron.schedule(
--   'cron-secuencias-correo-15m',
--   '*/15 * * * *',
--   $$
--     select net.http_post(
--       url     := 'https://owykkhwqpnumvgdeugmj.functions.supabase.co/cron-secuencias-correo',
--       headers := jsonb_build_object(
--                    'Content-Type','application/json',
--                    'x-webhook-secret','<TU_AUTO_TAG_CRON_SECRET>'
--                  ),
--       body    := '{}'
--     );
--   $$
-- );
--
-- Para ver / borrar / reprogramar:
--   select * from cron.job;
--   select cron.unschedule('cron-secuencias-correo-15m');
-- =====================================================================

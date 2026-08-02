-- =====================================================================
-- SECUENCIA DE SEGUIMIENTO · 2 CORREOS
-- ---------------------------------------------------------------------
-- Para FUTURAS campañas sobre el segmento "Recibidos" del seguimiento:
-- el correo 1 ya se envió (campaña anterior); esta secuencia agrega 2
-- correos de seguimiento (día 0 y +3) con guías, para re-contactar a
-- quienes RECIBIERON el primer correo.
-- Idempotente. Id fijo para re-ejecución segura.
-- =====================================================================

INSERT INTO public.secuencias_correo (id, nombre, descripcion, total_pasos) VALUES
  ('a1111111-0000-4000-8000-000000000002',
   'Seguimiento · 2 correos',
   '3 días, 2 seguimientos para quienes ya recibieron tu primer correo: sistema anti-fuga y agendamiento de demo.',
   2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.secuencias_correo_pasos
  (secuencia_id, paso, dias_desde_inicio, hora_envio, asunto, cuerpo, cta_texto, cta_url, guia_titulo)
VALUES
  ('a1111111-0000-4000-8000-000000000002', 1, 0, '09:00',
   '{{empresa}}: ¿tuviste tiempo de revisar la guía?',
$$Hola {{empresa}},

Te escribo para darle seguimiento a lo que te dejamos por correo. Sé que {{gancho}}, y la guía es solo el primer paso: aplicarla es donde aparecen los resultados.

Para que sea más fácil, te dejo también el sistema anti-fuga de leads que usan las corredoras que nunca se quedan sin consultas.

Es tuyo aquí 👇

Un saludo,
Mario · LexHouse$$,
   'Descargar el sistema anti-fuga', 'https://lexhouse-ai.homes/regalos/sistema-anti-fuga-leads.html',
   'Sistema anti-fuga de leads'),
  ('a1111111-0000-4000-8000-000000000002', 2, 3, '09:00',
   '{{empresa}}: falta el último paso para verlo aplicado',
$$Hola {{empresa}},

Con las dos guías ya tienes el método completo. Lo último que falta es verlo funcionando con tus propiedades en {{ciudad}}.

Te dejo este checklist de 5 preguntas para llegar con todo claro, y si quieres agendamos 20 minutos y te muestro cómo se vería en {{empresa}}.

Agenda aquí 👇

Un saludo,
Mario · LexHouse$$,
   'Agendar mi demo', 'https://lexhouse-ai.homes/regalos/checklist-antes-de-tu-reunion.html',
   'Checklist antes de tu reunión')
ON CONFLICT (secuencia_id, paso) DO NOTHING;

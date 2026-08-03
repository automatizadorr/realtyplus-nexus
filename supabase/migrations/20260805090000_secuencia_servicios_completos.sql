-- =====================================================================
-- SECUENCIA DE SERVICIOS COMPLETOS · LEXHOUSE (todo en uno)
-- ---------------------------------------------------------------------
-- Embudo de 3 correos que presenta el ecosistema completo de LexHouse:
-- software a medida, IA, CRM inmobiliario, agentes de voz IA, marketing
-- digital, prospección, reactivación de leads y generador de videos.
-- Cada paso regala una guía y el CTA lleva a la carta de presentación
-- (lexhouse-ai.com), el mejor lugar para conocer todo. Idempotente
-- (ON CONFLICT DO NOTHING).
-- =====================================================================

INSERT INTO public.secuencias_correo (id, nombre, descripcion, total_pasos) VALUES
  ('a1111111-0000-4000-8000-000000000006',
   'Servicios completos · Todo en uno',
   '6 días: el ecosistema LexHouse completo — software, IA, CRM, voz, prospección, video — con una guía por correo y CTA a lexhouse-ai.com.',
   3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.secuencias_correo_pasos
  (secuencia_id, paso, dias_desde_inicio, hora_envio, asunto, cuerpo, cta_texto, cta_url, guia_titulo)
VALUES
  ('a1111111-0000-4000-8000-000000000006', 1, 0, '09:00',
   '{{empresa}}: software, IA y marketing para corredoras — en un solo lugar',
$$Hola {{nombre}},

Sé que estás ocupado, así que voy directo al punto: LexHouse no es una herramienta más, es un ecosistema completo construido alrededor de corredoras como {{empresa}}, especialmente para cuando {{gancho}}.

Un solo proveedor para todo tu lado digital:

- Software a medida e inteligencia artificial.
- CRM inmobiliario con captación de leads en un solo panel.
- Agentes de voz IA que atienden y califican llamadas.
- Marketing digital, prospección y reactivación de leads.
- Generador de videos por IA para tus propiedades.

Te dejo de regalo un autodiagnóstico de 2 minutos que te dice cuántos leads se escapan hoy. Y en nuestra web te muestro el ecosistema completo, producto por producto 👇

Un saludo,
Mario · LexHouse$$,
   'Descargar autodiagnóstico gratis', 'https://lexhouse-ai.homes/regalos/autodiagnostico-corredora.html',
   'Autodiagnóstico de corredora (2 min)'),
  ('a1111111-0000-4000-8000-000000000006', 2, 3, '09:00',
   '{{empresa}}: tu próxima venta puede estar en tu base de datos',
$$Hola {{nombre}},

La mayoría de las corredoras persigue leads nuevos mientras los contactos antiguos se enfrían en una planilla. Reactivar uno de esos cuesta hasta 7 veces menos que captar uno nuevo.

Te dejo de regalo la secuencia exacta de 3 mensajes para revivir clientes fríos (día 0, día 2 y día 5) y el cierre que reactiva a 1 de cada 5 contactos dormidos.

Y cuando lo quieras, míralo aplicado a {{ciudad}}: en la web de LexHouse te muestro cómo se automatiza la reactivación, la prospección y todo el ecosistema 👇

Un saludo,
Mario · LexHouse$$,
   'Descargar guía de reactivación', 'https://lexhouse-ai.homes/regalos/guia-reactivacion-clientes.html',
   'Guía: reactivación de clientes'),
  ('a1111111-0000-4000-8000-000000000006', 3, 6, '09:00',
   '{{empresa}}: el último paso es verlo en acción',
$$Hola {{nombre}},

En estos 6 días te dejé el lado estratégico — autodiagnóstico, reactivación y prospección — pero la tecnología se entiende mucho mejor viéndola en vivo.

Esa es exactamente la parte divertida: en lexhouse-ai.com tienes el ecosistema completo con demos reales de cada producto (agente de voz, videos con IA, CRM con campañas automáticas) y puedes agendar una demo de 20 minutos para verlo con las propiedades de {{empresa}}.

Recorre cada producto o agéndame abajo 👇

Un saludo,
Mario · LexHouse$$,
   'Ver el ecosistema LexHouse', 'https://lexhouse-ai.com',
   'Web: ecosistema LexHouse')
ON CONFLICT (secuencia_id, paso) DO NOTHING;
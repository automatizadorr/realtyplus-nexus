-- =====================================================================
-- Los 21 registros de contactos_log con plantilla_id venían de pruebas
-- de Mario (lexhouseai@gmail.com y srick2111@gmail.com) al validar la
-- Bandeja/Pipeline el 2026-08-20/21, no de vendedores reales usando el
-- sistema. Inflaban el gráfico "Plantillas más usadas" en Estadísticas
-- desde el primer día. Se borran para que arranque en cero de verdad.
-- =====================================================================
DELETE FROM public.contactos_log cl
USING auth.users u
WHERE cl.user_id = u.id
  AND cl.plantilla_id IS NOT NULL
  AND u.email IN ('lexhouseai@gmail.com', 'srick2111@gmail.com')
  AND cl.created_at BETWEEN '2026-08-20' AND '2026-08-22';

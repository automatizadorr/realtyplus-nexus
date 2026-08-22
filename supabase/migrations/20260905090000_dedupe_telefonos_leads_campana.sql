-- ============================================================
-- Anti-spam: un solo lead activo por número de teléfono (2026-09-05)
--
-- Problema real: la misma persona estaba cargada dos veces (una con prefijo de
-- país y otra sin él, a veces con el nombre escrito distinto), así que la cola
-- de WhatsApp le mandaba el mismo mensaje dos veces.
--
-- Nota: leads_campana tiene UNIQUE(telefono), así que NO puede haber dos filas
-- con el mismo texto exacto. Los duplicados son siempre de formato ('34600...'
-- vs '600...'), por eso se comparan los últimos 9 dígitos.
--
-- Tres pasos, en este orden (el orden importa por el UNIQUE):
--   1) Archivar (NO borrar) las filas sobrantes: queda UNA por
--      (país, últimos 9 dígitos). Reversible con un UPDATE.
--   2) Reapuntar los mensajes de WhatsApp guardados sin prefijo que pertenecen a
--      un lead de España, para que la conversación no se despegue en el inbox.
--   3) Normalizar los teléfonos de España a 34 + 9 dígitos (el formato del wa_id
--      de WhatsApp), saltando los que chocarían con una fila ya existente.
--
-- Idempotente: correrlo dos veces no cambia nada la segunda vez.
-- ============================================================

-- 1) Un solo lead activo por (país, últimos 9 dígitos). Se queda el que más
--    avanzado esté: no archivado > ya contactado > fuera de etapa "nuevo" > el
--    más antiguo. El resto pasa a archivado = true.
WITH norm AS (
  SELECT id, pais, archivado, etapa_venta, ultimo_contacto_at, created_at,
         regexp_replace(coalesce(telefono, ''), '[^0-9]', '', 'g') AS d
  FROM public.leads_campana
), conteo AS (
  SELECT id, pais, archivado, etapa_venta, ultimo_contacto_at, created_at,
         CASE WHEN length(d) >= 9 THEN right(d, 9) ELSE d END AS tel_norm
  FROM norm
  WHERE d <> ''
), ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY pais, tel_norm
    ORDER BY
      (archivado IS TRUE)::int,             -- primero los NO archivados
      (ultimo_contacto_at IS NULL)::int,    -- primero los que ya tuvieron contacto
      (etapa_venta = 'nuevo')::int,         -- primero los que avanzaron de etapa
      created_at                            -- desempate: el más antiguo manda
  ) AS rn
  FROM conteo
)
UPDATE public.leads_campana l
SET archivado = true, updated_at = now()
FROM ranked r
WHERE r.id = l.id
  AND r.rn > 1
  AND l.archivado IS NOT TRUE;

-- 2) Mensajes guardados con 9 dígitos que pertenecen a un lead de España que sí
--    se va a normalizar en el paso 3: se les antepone 34 para que sigan
--    enganchando con el lead.
UPDATE public.mensajes_whatsapp m
SET telefono = '34' || regexp_replace(m.telefono, '[^0-9]', '', 'g')
WHERE length(regexp_replace(m.telefono, '[^0-9]', '', 'g')) = 9
  AND EXISTS (
    SELECT 1 FROM public.leads_campana l
    WHERE l.pais = 'España'
      AND regexp_replace(l.telefono, '[^0-9]', '', 'g') = regexp_replace(m.telefono, '[^0-9]', '', 'g')
      AND left(regexp_replace(l.telefono, '[^0-9]', '', 'g'), 1) IN ('6', '7', '8', '9')
      AND NOT EXISTS (
        SELECT 1 FROM public.leads_campana c
        WHERE c.telefono = '34' || regexp_replace(l.telefono, '[^0-9]', '', 'g')
      )
  );

-- 3) Leads de España en 9 dígitos (móvil 6/7, fijo 8/9) → 34 + 9 dígitos.
--    Se salta cualquiera cuyo equivalente con 34 ya exista (el duplicado que se
--    acaba de archivar en el paso 1): el UNIQUE(telefono) lo rechazaría.
UPDATE public.leads_campana l
SET telefono = '34' || regexp_replace(l.telefono, '[^0-9]', '', 'g'),
    updated_at = now()
WHERE l.pais = 'España'
  AND length(regexp_replace(l.telefono, '[^0-9]', '', 'g')) = 9
  AND left(regexp_replace(l.telefono, '[^0-9]', '', 'g'), 1) IN ('6', '7', '8', '9')
  AND NOT EXISTS (
    SELECT 1 FROM public.leads_campana c
    WHERE c.telefono = '34' || regexp_replace(l.telefono, '[^0-9]', '', 'g')
  );

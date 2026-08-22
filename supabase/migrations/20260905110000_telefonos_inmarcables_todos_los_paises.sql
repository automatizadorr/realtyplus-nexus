-- ============================================================
-- Teléfonos inmarcables, todos los países (2026-09-05)
--
-- Continuación de 20260905100000 (que solo tocó España). OJO: el criterio de
-- España ("menos de 9 dígitos") NO se puede copiar tal cual — en Panamá,
-- Bolivia, Uruguay, Honduras, Guatemala, Costa Rica, El Salvador, Cuba,
-- Nicaragua, Noruega, Dinamarca, Chipre, Malta, Bahréin... el número nacional
-- tiene 8 dígitos y es perfectamente válido (normalizePhone le antepone el
-- código del país). Aplicar "menos de 9" archivaría ~380 leads buenos.
--
-- Criterio universal: se archiva solo lo que no se puede marcar en ningún país.
--   a) menos de 8 dígitos — el propio frontend ya se niega a armar el link de
--      WhatsApp por debajo de 8 (waLink: `if (raw.length < 8) return null`),
--   b) más de 15 dígitos — E.164 no admite más,
--   c) 7 ceros seguidos o más — relleno ('3580000000', '38599300000000000').
--
-- Antes de archivar se RESCATAN las filas con DOS números pegados en el mismo
-- campo ('4433251840/4433170128', '46702601660+46737664280'): se quedan con el
-- primero que sea marcable, en vez de perder un lead alcanzable.
--
-- Archivado, NO borrado. Idempotente.
-- ============================================================

-- 1) Rescate: campo con varios números → se queda el primero marcable.
--    Se salta si ese número ya existe en otra fila (UNIQUE(telefono)).
WITH cand AS (
  SELECT l.id,
         (SELECT regexp_replace(p.parte, '[^0-9]', '', 'g')
            FROM unnest(regexp_split_to_array(regexp_replace(l.telefono, '^\s*\+', ''), '[/+.,;]'))
                 WITH ORDINALITY AS p(parte, orden)
           WHERE length(regexp_replace(p.parte, '[^0-9]', '', 'g')) BETWEEN 8 AND 15
           ORDER BY p.orden
           LIMIT 1) AS primero
    FROM public.leads_campana l
   WHERE l.archivado IS NOT TRUE
     AND length(regexp_replace(coalesce(l.telefono, ''), '[^0-9]', '', 'g')) > 15
)
UPDATE public.leads_campana l
SET telefono = c.primero, updated_at = now()
FROM cand c
WHERE l.id = c.id
  AND c.primero IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.leads_campana o WHERE o.telefono = c.primero);

-- 2) Archiva lo que quedó inmarcable, en todos los países.
UPDATE public.leads_campana l
SET archivado = true, updated_at = now()
WHERE l.archivado IS NOT TRUE
  AND (
        length(regexp_replace(coalesce(l.telefono, ''), '[^0-9]', '', 'g')) < 8
     OR length(regexp_replace(coalesce(l.telefono, ''), '[^0-9]', '', 'g')) > 15
     OR regexp_replace(coalesce(l.telefono, ''), '[^0-9]', '', 'g') ~ '0{7,}'
  );

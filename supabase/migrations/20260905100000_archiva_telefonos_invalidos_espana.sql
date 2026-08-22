-- ============================================================
-- Archiva los leads de España con teléfono imposible de marcar (2026-09-05)
--
-- No es "todo lo que no parece español": muchos leads con pais = 'España'
-- tienen un teléfono EXTRANJERO perfectamente válido (54 Argentina,
-- 58 Venezuela, 57 Colombia, 1 USA, 351 Portugal, 376 Andorra, 33 Francia…).
-- Esos son leads reales y NO se tocan.
--
-- Se archiva solo lo que no se puede marcar de ninguna forma:
--   a) menos de 9 dígitos (hay 79 leads con solo 5 dígitos, otros con 1, 3, 4…),
--   b) exactamente 9 dígitos que no empiezan en 6/7/8/9 — un número español
--      siempre empieza por ahí, así que eso es relleno ('111111111').
--
-- Archivado, NO borrado: revertir es
--   UPDATE leads_campana SET archivado = false WHERE id IN (...);
-- Idempotente.
-- ============================================================
UPDATE public.leads_campana l
SET archivado = true, updated_at = now()
WHERE l.pais = 'España'
  AND l.archivado IS NOT TRUE
  AND (
        length(regexp_replace(coalesce(l.telefono, ''), '[^0-9]', '', 'g')) < 9
     OR (
          length(regexp_replace(coalesce(l.telefono, ''), '[^0-9]', '', 'g')) = 9
          AND left(regexp_replace(coalesce(l.telefono, ''), '[^0-9]', '', 'g'), 1) NOT IN ('6', '7', '8', '9')
        )
  );

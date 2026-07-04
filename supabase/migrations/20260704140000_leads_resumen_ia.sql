-- Persiste el "Resumen IA" que genera el clasificador (etiquetar-ia, DeepSeek) al
-- etiquetar un lead. Antes el resumen solo se devolvía en la respuesta y se perdía,
-- por eso el Excel del reporte de EXPANSIÓN (enviar-expansion → clasificacion-excel)
-- salía con la columna "Resumen IA" vacía: enviar-expansion corre por separado del
-- etiquetado y no tenía de dónde sacarlo. Ahora tag-lead lo guarda aquí y
-- clasificacion-excel lo lee de la BD como fallback.
-- Idempotente: se puede correr varias veces sin error.
ALTER TABLE public.leads_campana
  ADD COLUMN IF NOT EXISTS resumen_ia text;

COMMENT ON COLUMN public.leads_campana.resumen_ia IS
  'Resumen IA (1-2 frases) del estado/intención del lead, generado por etiquetar-ia (DeepSeek) al etiquetar. Lo escribe tag-lead; lo lee clasificacion-excel para la columna "Resumen IA".';

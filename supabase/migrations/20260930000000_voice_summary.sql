-- voice_summary — Add summary, analysis, tool_payload columns to voice_llamadas
-- Captures both ElevenLabs analysis.summary and agente_calificador tool payload

ALTER TABLE public.voice_llamadas
ADD COLUMN IF NOT EXISTS summary text,
ADD COLUMN IF NOT EXISTS analysis jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS tool_payload jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS voice_llamadas_analysis_gin ON public.voice_llamadas USING gin (analysis);

COMMENT ON COLUMN public.voice_llamadas.summary IS 'Unified summary: ElevenLabs analysis.summary OR agente_calificador.transcripcioncion_resumida_a_texto';
COMMENT ON COLUMN public.voice_llamadas.analysis IS 'Structured analysis from ElevenLabs: {perfil, dolor, urgencia, liquidez, volumen}';
COMMENT ON COLUMN public.voice_llamadas.tool_payload IS 'Full payload from agente_calificador tool: {Nombre_Lead, email, perfil_inmobiliario, volumen_propiedades, dolor_principal, urgencia, transcripcioncion_resumida_a_texto, liquides_lead, fecha_reunion, hora_reunion}';
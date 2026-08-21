-- Cada vendedor puede mandar hasta 55 correos/dia (ademas del cupo global
-- compartido de las 2 cuentas Resend, LIMITE_DIA=200 en _shared/correo.ts).
-- Se aplica en send-personalized-campaign leyendo esta columna.
ALTER TABLE public.vendedores ALTER COLUMN limite_mensajes_dia SET DEFAULT 55;
UPDATE public.vendedores SET limite_mensajes_dia = 55;

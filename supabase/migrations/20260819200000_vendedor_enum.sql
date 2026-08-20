-- PASO 1 DE 2: Añadir el valor 'vendedor' al enum app_role.
-- EJECUTAR ESTE BLOQUE SOLO y esperar confirmación ANTES de correr
-- 20260819200001_vendedor_schema.sql (mismo patrón que sub_admin:
-- Postgres no permite usar un valor de enum recién añadido en la
-- misma transacción en que se añadió, error 55P04).

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'vendedor';

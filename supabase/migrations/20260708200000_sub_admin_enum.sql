-- PASO 1 DE 2: Añadir el valor al enum.
-- EJECUTAR ESTE BLOQUE SOLO, hacer clic en "Run", y esperar confirmación
-- ANTES de correr el archivo 20260708200001_sub_admin_policies.sql
--
-- Razón: PostgreSQL no permite usar un valor de enum recién añadido
-- en la misma transacción en que se añadió (error 55P04).

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sub_admin';

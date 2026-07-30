-- Storage para imágenes de los correos (logo del remitente en Correos Personalizados).
-- Bucket PÚBLICO en lectura (el logo se incrusta en el HTML del email, URL sin firmar).
-- Escritura solo admins (misma política de rol que el resto de la herramienta).
-- Idempotente.

-- 1. Bucket 'email-assets' (público)
insert into storage.buckets (id, name, public)
values ('email-assets', 'email-assets', true)
on conflict (id) do update set public = true;

-- 2. Políticas RLS sobre storage.objects acotadas al bucket

-- Lectura pública (el cliente de correo debe poder cargar la imagen)
drop policy if exists "email_assets_public_read" on storage.objects;
create policy "email_assets_public_read"
  on storage.objects for select
  using (bucket_id = 'email-assets');

-- Subir / reemplazar / borrar: solo admins
drop policy if exists "email_assets_admin_insert" on storage.objects;
create policy "email_assets_admin_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'email-assets' and public.has_role(auth.uid(), 'admin'));

drop policy if exists "email_assets_admin_update" on storage.objects;
create policy "email_assets_admin_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'email-assets' and public.has_role(auth.uid(), 'admin'))
  with check (bucket_id = 'email-assets' and public.has_role(auth.uid(), 'admin'));

drop policy if exists "email_assets_admin_delete" on storage.objects;
create policy "email_assets_admin_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'email-assets' and public.has_role(auth.uid(), 'admin'));

-- Storage para fotos de perfil (avatares). Idempotente: se puede correr varias veces.
-- Ruta de archivo: {user_id}/avatar.jpg  → cada usuario solo escribe en su propia carpeta.
-- Bucket PÚBLICO en lectura (la foto se muestra en el sidebar sin firmar la URL).

-- 1. Bucket 'avatars' (público)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- 2. Políticas RLS sobre storage.objects acotadas al bucket 'avatars'

-- Lectura pública (cualquiera puede ver los avatares)
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Subir: solo el dueño, dentro de su carpeta {user_id}/...
drop policy if exists "avatars_owner_insert" on storage.objects;
create policy "avatars_owner_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Reemplazar (upsert): solo el dueño
drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Borrar: solo el dueño
drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

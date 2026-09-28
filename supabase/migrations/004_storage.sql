-- Public bucket for gesture photos captured in the admin panel.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gesture-media', 'gesture-media', true, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = true;

drop policy if exists "gesture media: read" on storage.objects;
create policy "gesture media: read" on storage.objects
  for select using (bucket_id = 'gesture-media');
drop policy if exists "gesture media: admin insert" on storage.objects;
create policy "gesture media: admin insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'gesture-media' and public.is_admin());
drop policy if exists "gesture media: admin update" on storage.objects;
create policy "gesture media: admin update" on storage.objects
  for update to authenticated using (bucket_id = 'gesture-media' and public.is_admin());
drop policy if exists "gesture media: admin delete" on storage.objects;
create policy "gesture media: admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'gesture-media' and public.is_admin());

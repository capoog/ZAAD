-- =============================================================================
-- Supabase-only objects: Storage buckets + Realtime authorization.
-- Guarded so the same migration is a no-op on the local PGlite/Postgres
-- fallback (which stores uploads on disk and streams events over SSE).
-- =============================================================================

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    -- Public menu images (anyone can read; only managers upload via the server).
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('menu-images', 'menu-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
    on conflict (id) do nothing;

    -- Private InstaPay transfer screenshots (server uploads; managers read via signed URLs).
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('payment-proofs', 'payment-proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
    on conflict (id) do nothing;

    execute $p$
      create policy "menu-images: public read" on storage.objects
        for select to anon, authenticated using (bucket_id = 'menu-images')
    $p$;
    execute $p$
      create policy "menu-images: managers write" on storage.objects
        for all to authenticated
        using (bucket_id = 'menu-images' and public.is_manager())
        with check (bucket_id = 'menu-images' and public.is_manager())
    $p$;
    execute $p$
      create policy "payment-proofs: managers read" on storage.objects
        for select to authenticated using (bucket_id = 'payment-proofs' and public.is_manager())
    $p$;
  end if;

  -- Realtime Authorization: only staff may join the private "staff:orders"
  -- broadcast topic. Customer topics are named after the order's unguessable
  -- tracking token and only ever carry {status, updatedAt}.
  if exists (select 1 from information_schema.tables where table_schema = 'realtime' and table_name = 'messages') then
    execute $p$
      create policy "realtime: staff orders topic" on realtime.messages
        for select to authenticated
        using (realtime.topic() = 'staff:orders' and public.is_staff())
    $p$;
  end if;
end $$;

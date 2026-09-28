-- Public discovery for published QR menus and waivers.
drop policy if exists digital_menus_public_published_read on public.digital_menus;
create policy digital_menus_public_published_read on public.digital_menus for select to anon,authenticated using(status='published');
drop policy if exists menu_items_public_published_read on public.menu_items;
create policy menu_items_public_published_read on public.menu_items for select to anon,authenticated using(exists(select 1 from public.digital_menus m where m.id=menu_items.menu_id and m.status='published'));
drop policy if exists waivers_public_published_read on public.waivers;
create policy waivers_public_published_read on public.waivers for select to anon,authenticated using(status='published');
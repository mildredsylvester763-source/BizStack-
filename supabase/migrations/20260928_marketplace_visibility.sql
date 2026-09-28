-- Authenticated businesses can discover published B2B marketplace listings.
drop policy if exists marketplace_listing_published_read on public.marketplace_listings;
create policy marketplace_listing_published_read on public.marketplace_listings
for select to authenticated
using(status='published');
-- Allow all role spellings used by the app's admin checks to read and moderate listings.
-- The UI recognizes the super_admin role, while the original products RLS
-- policies only recognized superadmin. This mismatch hid pending listings.
drop policy if exists "Admins view all products" on public.products;
create policy "Admins view all products"
on public.products for select
using (public.get_my_role() = any (array['admin'::text, 'superadmin'::text, 'super_admin'::text]));

drop policy if exists "Admins update all products" on public.products;
create policy "Admins update all products"
on public.products for update
using (public.get_my_role() = any (array['admin'::text, 'superadmin'::text, 'super_admin'::text]))
with check (public.get_my_role() = any (array['admin'::text, 'superadmin'::text, 'super_admin'::text]));

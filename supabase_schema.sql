-- ============================================================
-- ONLINE STORE — COMPLETE SUPABASE SCHEMA
-- Run this entire file in your Supabase SQL Editor:
-- https://supabase.com/dashboard → SQL Editor → New query
-- ============================================================

-- ─── PROFILES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      text,
  full_name     text,
  contact_email text,
  phone_number  text,
  address       text,
  role          text NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin','superadmin')),
  is_active     boolean NOT NULL DEFAULT true,
  account_type  text NOT NULL DEFAULT 'basic' CHECK (account_type IN ('basic','starter','premium')),
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Security-definer function reads role WITHOUT triggering RLS (prevents infinite recursion)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE POLICY "Users can view own profile"    ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"  ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles"  ON public.profiles FOR SELECT USING (
  public.get_my_role() IN ('admin','superadmin')
);

-- Auto-create profile row when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, contact_email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'full_name',
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── RPC: ROLE CHECKS ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role IN ('admin','superadmin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role = 'superadmin'
  );
$$;

-- ─── COUNTRIES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.countries (
  id       serial PRIMARY KEY,
  name     text NOT NULL,
  code     text NOT NULL UNIQUE,
  currency text NOT NULL DEFAULT 'USD'
);
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read countries" ON public.countries;
CREATE POLICY "Public read countries" ON public.countries FOR SELECT USING (true);

INSERT INTO public.countries (name, code, currency) VALUES
  ('Kenya',       'KE', 'KES'),
  ('Uganda',      'UG', 'UGX'),
  ('Tanzania',    'TZ', 'TZS'),
  ('Rwanda',      'RW', 'RWF'),
  ('Ethiopia',    'ET', 'ETB'),
  ('South Sudan', 'SS', 'SSP')
ON CONFLICT (code) DO NOTHING;

-- ─── DISTRICTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.districts (
  id         serial PRIMARY KEY,
  name       text NOT NULL,
  country_id integer NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS districts_country_idx ON public.districts(country_id);
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read districts" ON public.districts;
CREATE POLICY "Public read districts" ON public.districts FOR SELECT USING (true);

-- Seed districts (Kenya, Uganda, Rwanda)
INSERT INTO public.districts (name, country_id) SELECT d.name, c.id FROM (VALUES
  ('Nairobi','KE'),('Mombasa','KE'),('Kisumu','KE'),('Nakuru','KE'),('Eldoret','KE'),
  ('Kampala','UG'),('Entebbe','UG'),('Jinja','UG'),('Gulu','UG'),('Mbarara','UG'),
  ('Kigali','RW'),('Butare','RW'),('Gisenyi','RW'),
  ('Addis Ababa','ET'),('Dire Dawa','ET'),('Mekelle','ET'),
  ('Juba','SS'),('Wau','SS'),('Malakal','SS'),
  ('Dar es Salaam','TZ'),('Arusha','TZ'),('Mwanza','TZ')
) AS d(name, code) JOIN public.countries c ON c.code = d.code
WHERE NOT EXISTS (
  SELECT 1 FROM public.districts WHERE name = d.name AND country_id = c.id
);

-- ─── ACCOUNT TYPE LIMITS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.account_type_limits (
  id           serial PRIMARY KEY,
  account_type text NOT NULL UNIQUE CHECK (account_type IN ('basic','starter','premium')),
  max_products integer NOT NULL DEFAULT 3
);
ALTER TABLE public.account_type_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read limits" ON public.account_type_limits;
CREATE POLICY "Public read limits" ON public.account_type_limits FOR SELECT USING (true);

INSERT INTO public.account_type_limits (account_type, max_products) VALUES
  ('basic',   3),
  ('starter', 10),
  ('premium', 30)
ON CONFLICT (account_type) DO NOTHING;

-- ─── PRODUCTS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.products (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title              text NOT NULL,
  description        text,
  price              numeric(12,2) NOT NULL DEFAULT 0,
  category           text,
  available_quantity integer NOT NULL DEFAULT 1,
  storage_path       text,
  product_status     text NOT NULL DEFAULT 'draft' CHECK (product_status IN ('draft','published','rejected')),
  country_id         integer REFERENCES public.countries(id),
  county             text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS products_user_idx       ON public.products(user_id);
CREATE INDEX IF NOT EXISTS products_status_idx     ON public.products(product_status);
CREATE INDEX IF NOT EXISTS products_category_idx   ON public.products(category);
CREATE INDEX IF NOT EXISTS products_country_idx    ON public.products(country_id);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read published products" ON public.products;
DROP POLICY IF EXISTS "Sellers manage own products"    ON public.products;
DROP POLICY IF EXISTS "Admins view all products"       ON public.products;
DROP POLICY IF EXISTS "Admins update all products"     ON public.products;
CREATE POLICY "Public read published products" ON public.products FOR SELECT USING (product_status = 'published' OR auth.uid() = user_id);
CREATE POLICY "Sellers manage own products"    ON public.products FOR ALL    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all products"       ON public.products FOR SELECT USING (public.get_my_role() IN ('admin','superadmin'));
CREATE POLICY "Admins update all products"     ON public.products FOR UPDATE USING (public.get_my_role() IN ('admin','superadmin'));

-- ─── PRODUCT IMAGES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_images (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  storage_path  text NOT NULL,
  is_main       boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_images_product_idx ON public.product_images(product_id);
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read product images"     ON public.product_images;
DROP POLICY IF EXISTS "Owners manage product images"   ON public.product_images;
CREATE POLICY "Public read product images"   ON public.product_images FOR SELECT USING (true);
CREATE POLICY "Owners manage product images" ON public.product_images FOR ALL
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.user_id = auth.uid()));

-- ─── REVIEWS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating     integer CHECK (rating BETWEEN 1 AND 5),
  content    text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reviews_product_idx ON public.reviews(product_id);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read reviews"   ON public.reviews;
DROP POLICY IF EXISTS "Auth users post review" ON public.reviews;
CREATE POLICY "Public read reviews"    ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Auth users post review" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ─── WISHLIST ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wishlist (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);
CREATE INDEX IF NOT EXISTS wishlist_user_idx ON public.wishlist(user_id);
ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own wishlist" ON public.wishlist;
CREATE POLICY "Users manage own wishlist" ON public.wishlist FOR ALL USING (auth.uid() = user_id);

-- ─── CART ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cart (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cart ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own cart" ON public.cart;
CREATE POLICY "Users manage own cart" ON public.cart FOR ALL USING (auth.uid() = user_id);

-- ─── CART ITEMS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cart_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id    uuid NOT NULL REFERENCES public.cart(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity   integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cart_id, product_id)
);
CREATE INDEX IF NOT EXISTS cart_items_cart_idx ON public.cart_items(cart_id);
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own cart items" ON public.cart_items;
CREATE POLICY "Users manage own cart items" ON public.cart_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.cart WHERE cart.id = cart_id AND cart.user_id = auth.uid())
);

-- ─── ORDERS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','shipped','delivered','cancelled')),
  total_amount     numeric(12,2) NOT NULL DEFAULT 0,
  shipping_address text,
  shipping_name    text,
  shipping_phone   text,
  payment_status   text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid','refunded')),
  payment_method   text,
  payment_id       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_user_idx ON public.orders(user_id);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own orders" ON public.orders;
CREATE POLICY "Users manage own orders" ON public.orders FOR ALL USING (auth.uid() = user_id);

-- ─── ORDER ITEMS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id     uuid NOT NULL REFERENCES public.products(id),
  quantity       integer NOT NULL DEFAULT 1,
  price_at_time  numeric(12,2) NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON public.order_items(order_id);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own order items" ON public.order_items;
CREATE POLICY "Users view own order items" ON public.order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_id AND orders.user_id = auth.uid())
);

-- ─── WALLETS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wallets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance    numeric(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  currency   text NOT NULL DEFAULT 'KES',
  status     text NOT NULL DEFAULT 'active' CHECK (status IN ('active','frozen','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own wallet" ON public.wallets;
CREATE POLICY "Users view own wallet" ON public.wallets FOR SELECT USING (auth.uid() = user_id);

-- ─── WALLET TRANSACTIONS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id   uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('deposit','debit','refund','discount')),
  amount      numeric(12,2) NOT NULL DEFAULT 0,
  source      text,
  reference   text,
  description text,
  status      text NOT NULL DEFAULT 'posted' CHECK (status IN ('pending','posted','failed')),
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wallet_tx_wallet_idx ON public.wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS wallet_tx_user_idx   ON public.wallet_transactions(user_id);
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own transactions" ON public.wallet_transactions;
CREATE POLICY "Users view own transactions" ON public.wallet_transactions FOR SELECT USING (auth.uid() = user_id);

-- ─── PAYMENTS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id         uuid REFERENCES public.orders(id),
  method           text NOT NULL DEFAULT 'mpesa' CHECK (method IN ('mpesa','wallet','card')),
  amount           numeric(12,2) NOT NULL DEFAULT 0,
  wallet_amount    numeric(12,2),
  discount_applied numeric(12,2),
  currency         text NOT NULL DEFAULT 'KES',
  status           text NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','pending','paid','failed','refunded')),
  phone            text,
  mpesa_checkout_id text,
  mpesa_receipt    text,
  callback_payload jsonb,
  price_locked_at  timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_user_idx     ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS payments_checkout_idx ON public.payments(mpesa_checkout_id);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own payments" ON public.payments;
CREATE POLICY "Users view own payments" ON public.payments FOR SELECT USING (auth.uid() = user_id);

-- ─── STORAGE BUCKET ─────────────────────────────────────────
-- Run this only if the 'images' bucket does not already exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read images"  ON storage.objects;
DROP POLICY IF EXISTS "Auth users upload"   ON storage.objects;
DROP POLICY IF EXISTS "Owners delete image" ON storage.objects;
CREATE POLICY "Public read images"  ON storage.objects FOR SELECT USING (bucket_id = 'images');
CREATE POLICY "Auth users upload"   ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'images' AND auth.uid() IS NOT NULL);
CREATE POLICY "Owners delete image" ON storage.objects FOR DELETE USING (bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ─── DONE ────────────────────────────────────────────────────
-- All tables, policies, seed data, RPC functions created.
-- Next: go to Authentication → Users in Supabase dashboard
-- and create your test accounts, OR click "Create Test Accounts"
-- in the app login screen after setup.

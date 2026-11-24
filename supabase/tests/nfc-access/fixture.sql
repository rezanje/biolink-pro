-- Lingkungan uji mirip Supabase, data dummy saja. Aturan akses = kondisi
-- sebelum perbaikan (gabungan complete-setup, b2b_rbac, plg_admin_fix).
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz, created_at timestamptz DEFAULT now());
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;

CREATE TYPE public.user_role AS ENUM ('super_admin', 'company_admin', 'user');

CREATE TABLE public.companies (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, logo_url text, created_at timestamptz DEFAULT now());
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid UNIQUE, slug text UNIQUE, display_name text, bio text,
  email text, role public.user_role DEFAULT 'user', company_id uuid REFERENCES public.companies(id),
  tier text DEFAULT 'FREE', subscription_valid_until timestamptz, is_public boolean DEFAULT true,
  special_edition text, special_editions text[]);
CREATE TABLE public.products (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, slug text);
CREATE TABLE public.serial_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), serial_uuid uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id), variant_id uuid, owner_id uuid, activation_code text, is_claimed boolean DEFAULT false, claimed_at timestamptz,
  nfc_tap_count int DEFAULT 0, last_tapped_at timestamptz, sync_enabled boolean DEFAULT true, profile_id uuid,
  special_edition text, special_editions text[], company_id uuid, event_id uuid, device_type_id uuid,
  gift_enabled boolean DEFAULT false, gift_url text, gift_message text, gift_from text, gift_opened_at timestamptz,
  gift_token text, created_at timestamptz DEFAULT now());
CREATE TABLE public.ownership_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), serial_id uuid, to_user_id uuid, transfer_type text);

-- Supabase memberi hak tabel penuh ke anon/authenticated secara default.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.serial_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (TRUE);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Super Admins can update any profile" ON public.profiles FOR UPDATE USING ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'super_admin');
CREATE POLICY "Products viewable by everyone" ON public.products FOR SELECT USING (TRUE);
CREATE POLICY "Serial status viewable" ON public.serial_numbers FOR SELECT USING (TRUE);
CREATE POLICY "Allow insert serials" ON public.serial_numbers FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Allow update serials" ON public.serial_numbers FOR UPDATE USING (TRUE);
CREATE POLICY "Allow delete serials" ON public.serial_numbers FOR DELETE USING (TRUE);
CREATE POLICY "Companies are viewable by everyone" ON public.companies FOR SELECT USING (true);
CREATE POLICY "Enable insert for everyone" ON public.companies FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for everyone" ON public.companies FOR UPDATE USING (true);
CREATE POLICY "Enable delete for everyone" ON public.companies FOR DELETE USING (true);

CREATE FUNCTION public.increment_tap_count(p_serial_uuid uuid) RETURNS void AS $$
BEGIN UPDATE public.serial_numbers SET nfc_tap_count = nfc_tap_count + 1, last_tapped_at = now() WHERE serial_uuid = p_serial_uuid; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE FUNCTION public.claim_serial_number(p_serial_uuid uuid, p_user_id uuid) RETURNS jsonb AS $$
DECLARE v record;
BEGIN
  SELECT * INTO v FROM public.serial_numbers WHERE serial_uuid = p_serial_uuid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Serial not found'); END IF;
  IF v.is_claimed THEN RETURN jsonb_build_object('success', false, 'error', 'Already claimed'); END IF;
  UPDATE public.serial_numbers SET owner_id = p_user_id, is_claimed = true, claimed_at = now() WHERE id = v.id;
  INSERT INTO public.ownership_logs (serial_id, to_user_id, transfer_type) VALUES (v.id, p_user_id, 'claim');
  RETURN jsonb_build_object('success', true, 'serial_id', v.id);
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------- Data dummy ----------
INSERT INTO public.companies (id, name) VALUES
 ('c0000000-0000-0000-0000-00000000000a', 'Dummy Co A'), ('c0000000-0000-0000-0000-00000000000b', 'Dummy Co B');
INSERT INTO public.products (id, name, slug) VALUES ('d0000000-0000-0000-0000-000000000001', 'Dummy Watch', 'dummy-watch');
INSERT INTO auth.users (id, email, email_confirmed_at, created_at) VALUES
 ('a0000000-0000-0000-0000-000000000001', 'owner@example.test', now(), now() - interval '10 days'),
 ('a0000000-0000-0000-0000-000000000002', 'other@example.test', now(), now() - interval '10 days'),
 ('a0000000-0000-0000-0000-000000000003', 'admin@example.test', now(), now() - interval '10 days'),
 ('a0000000-0000-0000-0000-000000000004', 'coadmin@example.test', now(), now() - interval '10 days'),
 ('a0000000-0000-0000-0000-000000000005', 'member@example.test', now(), now() - interval '10 days'),
 ('a0000000-0000-0000-0000-000000000006', 'newbie@example.test', NULL, now()),
 ('a0000000-0000-0000-0000-000000000007', 'stale@example.test', NULL, now() - interval '2 days');
INSERT INTO public.profiles (user_id, slug, display_name, email, role, company_id) VALUES
 ('a0000000-0000-0000-0000-000000000001', 'owner', 'Owner', 'owner@example.test', 'user', NULL),
 ('a0000000-0000-0000-0000-000000000002', 'other', 'Other', 'other@example.test', 'user', NULL),
 ('a0000000-0000-0000-0000-000000000003', 'admin', 'Admin', 'admin@example.test', 'super_admin', NULL),
 ('a0000000-0000-0000-0000-000000000004', 'coadmin', 'CoAdmin', 'coadmin@example.test', 'company_admin', 'c0000000-0000-0000-0000-00000000000a'),
 ('a0000000-0000-0000-0000-000000000005', 'member', 'Member', 'member@example.test', 'user', 'c0000000-0000-0000-0000-00000000000a');
INSERT INTO public.serial_numbers (serial_uuid, product_id, owner_id, is_claimed, claimed_at, gift_enabled, gift_url, gift_message, gift_token) VALUES
 ('50000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', true, now(), false, NULL, NULL, NULL),
 ('50000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', NULL, false, NULL, true, 'https://example.test/video', 'Selamat!', 'dummygifttoken0002'),
 ('50000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', NULL, false, NULL, false, NULL, NULL, NULL),
 ('50000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005', true, now(), false, NULL, NULL, NULL),
 ('50000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000001', NULL, false, NULL, false, NULL, NULL, 'dummygifttoken0005'),
 ('50000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000001', NULL, false, NULL, false, NULL, NULL, NULL);

UPDATE public.serial_numbers SET activation_code = 'DUMMYCODE' WHERE serial_uuid = '50000000-0000-0000-0000-000000000002';

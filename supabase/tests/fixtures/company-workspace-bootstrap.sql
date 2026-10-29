CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE TABLE public.profiles (
 id uuid PRIMARY KEY, user_id uuid UNIQUE NOT NULL, role text NOT NULL DEFAULT 'user', company_id uuid,
 theme jsonb NOT NULL DEFAULT '{}'::jsonb,
 display_name text, email text, job_title text, slug text, avatar_url text, lead_capture_enabled boolean DEFAULT false,
 bio text, phone text, company text, social_links jsonb DEFAULT '[]'::jsonb, is_public boolean DEFAULT true,
 tier text DEFAULT 'FREE', subscription_valid_until timestamptz, lead_capture_delay integer DEFAULT 4,
 special_edition text, special_editions jsonb DEFAULT '[]'::jsonb,
 selected_special_greeting_anim text, enable_special_greeting_anim boolean DEFAULT false,
 pet_enabled boolean DEFAULT true, pet_character_id text, pet_name text
);
CREATE TABLE public.companies (
 id uuid PRIMARY KEY, name text NOT NULL, logo_url text, website text, theme jsonb, admin_id uuid,
 updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.leads (
 id uuid PRIMARY KEY, profile_id uuid REFERENCES public.profiles(id), status text DEFAULT 'new', name text,
 email text, whatsapp text, company text, created_at timestamptz DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid());
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id=auth.uid());
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners update leads" ON public.leads FOR UPDATE TO authenticated USING
(profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Owner view leads" ON public.leads FOR SELECT TO authenticated USING
(profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Companies are viewable by everyone" ON public.companies FOR SELECT USING (true);
CREATE POLICY "Enable insert for everyone" ON public.companies FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for everyone" ON public.companies FOR UPDATE USING (true);
CREATE POLICY "Enable delete for everyone" ON public.companies FOR DELETE USING (true);
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO anon, authenticated;
GRANT SELECT ON public.leads TO anon;
GRANT SELECT, UPDATE ON public.leads TO authenticated;
GRANT USAGE ON SCHEMA public, auth TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
INSERT INTO public.companies(id,name) VALUES ('00000000-0000-0000-0000-000000000101','Candra Naya Lestari'),('00000000-0000-0000-0000-000000000102','Other Co');
INSERT INTO public.profiles(id,user_id,role,company_id) VALUES
('00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000301','company_admin','00000000-0000-0000-0000-000000000101'),
('00000000-0000-0000-0000-000000000202','00000000-0000-0000-0000-000000000302','user','00000000-0000-0000-0000-000000000101'),
('00000000-0000-0000-0000-000000000203','00000000-0000-0000-0000-000000000303','company_admin','00000000-0000-0000-0000-000000000102'),
('00000000-0000-0000-0000-000000000204','00000000-0000-0000-0000-000000000304','super_admin',null);
UPDATE public.profiles SET slug = 'sample-' || right(id::text, 3), display_name = 'Sample card',
    email = 'public@example.test', phone = '+6200000000', theme = '{"template_id":"classic","view_count":12,"private_future_key":"secret"}'::jsonb;
UPDATE public.profiles SET is_public = false WHERE id = '00000000-0000-0000-0000-000000000203';
INSERT INTO public.leads(id,profile_id,status,name) VALUES
('00000000-0000-0000-0000-000000000401','00000000-0000-0000-0000-000000000202','new','CNY Lead'),
('00000000-0000-0000-0000-000000000402','00000000-0000-0000-0000-000000000203','new','Other Lead');

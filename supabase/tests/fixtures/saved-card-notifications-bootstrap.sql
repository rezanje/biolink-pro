-- Minimal disposable Supabase contract; never run against a real project.
CREATE SCHEMA auth;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE TABLE public.profiles (
    id uuid PRIMARY KEY, user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, slug text UNIQUE NOT NULL,
    display_name text, is_public boolean DEFAULT true, is_master boolean DEFAULT false,
    tier text DEFAULT 'FREE', created_at timestamptz DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_profiles ON public.profiles FOR SELECT USING (is_public IS DISTINCT FROM false OR user_id = auth.uid());
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
GRANT SELECT ON public.profiles TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

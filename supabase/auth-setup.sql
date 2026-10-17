-- ============================================================
-- InstituteOS · Supabase Auth Setup
-- Run this AFTER schema.sql in the Supabase SQL Editor
-- ============================================================

-- 1. User profiles table (mirrors auth.users with institute role)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (role IN ('pending','owner','counselor','trainer','accounts')),
  name        TEXT        NOT NULL DEFAULT '',
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "user_profiles: self read"  ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "user_profiles: self update" ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

REVOKE UPDATE ON public.user_profiles FROM anon, authenticated;
GRANT UPDATE (name, avatar_url) ON public.user_profiles TO authenticated;

-- -------------------------------------------------------
-- 2. Trigger: auto-create a pending profile; privileges require admin assignment
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  _name TEXT;
BEGIN
  _name := COALESCE(
    NEW.raw_user_meta_data ->> 'name',
    pg_catalog.split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.user_profiles (id, role, name)
  VALUES (NEW.id, 'pending', _name)
  ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name, updated_at = pg_catalog.now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

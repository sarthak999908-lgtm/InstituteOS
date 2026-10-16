-- ============================================================
-- InstituteOS · Supabase Auth Setup
-- Run this AFTER schema.sql in the Supabase SQL Editor
-- ============================================================

-- 1. User profiles table (mirrors auth.users with institute role)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL DEFAULT 'counselor'
                          CHECK (role IN ('owner','counselor','trainer','accounts')),
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
  FOR UPDATE USING (auth.uid() = id);

-- Service role (backend) can manage all profiles
CREATE POLICY "user_profiles: service full" ON public.user_profiles
  USING (auth.jwt() ->> 'role' = 'service_role');

-- -------------------------------------------------------
-- 2. Trigger: auto-create user_profile on auth.users INSERT
--    Reads 'role' from raw_user_meta_data supplied at sign-up
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _role TEXT;
  _name TEXT;
BEGIN
  -- Prefer the role stored in raw_user_meta_data (passed at sign-up)
  _role := COALESCE(
    NEW.raw_user_meta_data ->> 'role',
    'counselor'
  );
  _name := COALESCE(
    NEW.raw_user_meta_data ->> 'name',
    split_part(NEW.email, '@', 1)
  );

  -- Validate; fall back to counselor
  IF _role NOT IN ('owner','counselor','trainer','accounts') THEN
    _role := 'counselor';
  END IF;

  INSERT INTO public.user_profiles (id, role, name)
  VALUES (NEW.id, _role, _name)
  ON CONFLICT (id) DO UPDATE
    SET role = EXCLUDED.role, name = EXCLUDED.name, updated_at = now();

  -- Also stamp role into app_metadata so JWT carries it (used by RLS policies)
  UPDATE auth.users
  SET raw_app_meta_data =
        COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', _role)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -------------------------------------------------------
-- 3. Demo users seed (optional — requires Auth API or Supabase UI)
--    Run only if you want pre-created demo accounts.
--    Passwords are set via Auth UI / CLI, NOT here.
-- -------------------------------------------------------
-- INSERT INTO auth.users ... is not possible via SQL editor directly.
-- Use: Dashboard → Authentication → Users → "Add user" with the emails below
--   owner@demo.instituteos.app       role=owner
--   counselor@demo.instituteos.app   role=counselor
--   trainer@demo.instituteos.app     role=trainer
--   accounts@demo.instituteos.app    role=accounts
-- Then run the profile patch below once users exist:
/*
INSERT INTO public.user_profiles (id, role, name)
SELECT id,
       CASE split_part(email,'@',1)
         WHEN 'owner'     THEN 'owner'
         WHEN 'counselor' THEN 'counselor'
         WHEN 'trainer'   THEN 'trainer'
         WHEN 'accounts'  THEN 'accounts'
         ELSE 'counselor'
       END,
       initcap(split_part(email,'@',1))
FROM auth.users
WHERE email LIKE '%@demo.instituteos.app'
ON CONFLICT (id) DO UPDATE
  SET role = EXCLUDED.role, name = EXCLUDED.name;
*/

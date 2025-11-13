-- Complete database setup for SPE App
-- Run this in your Supabase SQL Editor

-- 1. Create the Users table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.Users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    age INTEGER NOT NULL,
    sex TEXT NOT NULL CHECK (sex IN ('male', 'female', 'other')),
    baseline_hr DECIMAL(5,2) NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at DATE DEFAULT CURRENT_DATE
);

-- 1a. Ensure existing installations pick up the latest required columns/defaults
ALTER TABLE public.Users
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS age INTEGER,
  ADD COLUMN IF NOT EXISTS sex TEXT,
  ADD COLUMN IF NOT EXISTS baseline_hr DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS role TEXT,
  ADD COLUMN IF NOT EXISTS created_at DATE DEFAULT CURRENT_DATE;

UPDATE public.Users
SET name = COALESCE(NULLIF(TRIM(name), ''), email)
WHERE name IS NULL OR TRIM(name) = '';

UPDATE public.Users
SET age = 25
WHERE age IS NULL OR age < 1 OR age > 120;

UPDATE public.Users
SET sex = 'other'
WHERE sex IS NULL OR LOWER(sex) NOT IN ('male', 'female', 'other');

UPDATE public.Users
SET baseline_hr = 70.0
WHERE baseline_hr IS NULL OR baseline_hr < 30 OR baseline_hr > 200;

UPDATE public.Users
SET role = 'user'
WHERE role IS NULL OR LOWER(role) NOT IN ('user', 'admin');

UPDATE public.Users
SET created_at = CURRENT_DATE
WHERE created_at IS NULL;

ALTER TABLE public.Users
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN age SET NOT NULL,
  ALTER COLUMN sex SET NOT NULL,
  ALTER COLUMN baseline_hr TYPE DECIMAL(5,2),
  ALTER COLUMN baseline_hr SET NOT NULL,
  ALTER COLUMN role SET NOT NULL,
  ALTER COLUMN role SET DEFAULT 'user',
  ALTER COLUMN created_at SET DEFAULT CURRENT_DATE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND conname = 'users_sex_check'
  ) THEN
    ALTER TABLE public.Users
      ADD CONSTRAINT users_sex_check CHECK (sex IN ('male', 'female', 'other'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND conname = 'users_role_check'
  ) THEN
    ALTER TABLE public.Users
      ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND conname = 'users_pkey'
  ) THEN
    ALTER TABLE public.Users
      ADD CONSTRAINT users_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND conname = 'users_id_fkey'
  ) THEN
    ALTER TABLE public.Users
      ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2. Enable Row Level Security
ALTER TABLE public.Users ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own profile" ON public.Users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.Users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.Users;

-- 4. Create new policies
CREATE POLICY "Users can view own profile" ON public.Users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.Users
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.Users
    FOR UPDATE USING (auth.uid() = id);

-- 5. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.Users TO anon, authenticated;

-- 6. Ensure any existing trigger for new-auth users is reset
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 7. Create a function to handle new user creation with sane defaults
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  meta jsonb := NEW.raw_user_meta_data;
  meta_name text;
  meta_age integer;
  meta_sex text;
  meta_baseline numeric(5,2);
  meta_role text;
  raw_age text;
  raw_baseline text;
BEGIN
  meta_name := COALESCE(NULLIF(meta->>'name', ''), NULLIF(meta->>'full_name', ''), NEW.email);

  raw_age := meta->>'age';
  BEGIN
    IF raw_age IS NULL OR trim(raw_age) = '' THEN
      meta_age := 25;
    ELSE
      meta_age := raw_age::integer;
    END IF;
  EXCEPTION
    WHEN others THEN
      meta_age := 25;
  END;
  IF meta_age < 1 OR meta_age > 120 THEN
    meta_age := 25;
  END IF;

  meta_sex := LOWER(COALESCE(NULLIF(meta->>'sex', ''), 'other'));
  IF meta_sex NOT IN ('male', 'female', 'other') THEN
    meta_sex := 'other';
  END IF;

  raw_baseline := meta->>'baseline_hr';
  BEGIN
    IF raw_baseline IS NULL OR trim(raw_baseline) = '' THEN
      meta_baseline := 70.0;
    ELSE
      meta_baseline := raw_baseline::numeric(5,2);
    END IF;
  EXCEPTION
    WHEN others THEN
      meta_baseline := 70.0;
  END;
  IF meta_baseline < 30 OR meta_baseline > 200 THEN
    meta_baseline := 70.0;
  END IF;

  meta_role := LOWER(COALESCE(NULLIF(meta->>'role', ''), 'user'));
  IF meta_role NOT IN ('user', 'admin') THEN
    meta_role := 'user';
  END IF;

  INSERT INTO public.Users (id, email, name, age, sex, baseline_hr, role, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    meta_name,
    meta_age,
    meta_sex,
    meta_baseline,
    meta_role,
    CURRENT_DATE
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Ensure trigger exists to run the function whenever an auth user is created
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- 9. Check if the table was created successfully
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'Users' 
AND table_schema = 'public'
ORDER BY ordinal_position;


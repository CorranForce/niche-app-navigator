ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS workspace_name text,
  ADD COLUMN IF NOT EXISTS role_title text,
  ADD COLUMN IF NOT EXISTS use_case text,
  ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_key
  ON public.profiles (lower(email)) WHERE email IS NOT NULL;

UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE u.id = p.id AND p.email IS NULL;
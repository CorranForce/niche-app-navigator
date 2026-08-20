INSERT INTO public.user_roles (user_id, role)
VALUES ('215eeb65-d92f-4a7f-ac22-ca921821527b', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
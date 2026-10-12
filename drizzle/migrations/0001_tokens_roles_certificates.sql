CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  token_balance integer NOT NULL DEFAULT 0 CHECK (token_balance >= 0),
  union_name_and_no text NOT NULL DEFAULT '',
  upazila text NOT NULL DEFAULT '',
  district text NOT NULL DEFAULT '',
  ward_member_no text NOT NULL DEFAULT '',
  chairman_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.settings (key text PRIMARY KEY, value integer NOT NULL);
GRANT SELECT ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.settings (key, value) VALUES ('cost_per_certificate', 1);

CREATE TABLE public.token_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  type text NOT NULL CHECK (type IN ('admin_adjust', 'certificate')),
  note text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.token_transactions TO authenticated;
GRANT ALL ON public.token_transactions TO service_role;
ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
$$;

CREATE POLICY "Read own profile" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Read settings" ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Read own transactions" ON public.token_transactions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
INSERT INTO public.profiles (user_id, full_name) SELECT id, split_part(email, '@', 1) FROM auth.users ON CONFLICT DO NOTHING;

CREATE SEQUENCE public.certificate_no_seq START 1;
ALTER TABLE public.certificates
  ADD COLUMN public_id text UNIQUE,
  ADD COLUMN certificate_no text UNIQUE,
  ADD COLUMN tokens_charged integer;

DROP POLICY IF EXISTS "Create own certificates" ON public.certificates;
DROP POLICY IF EXISTS "Update own certificates" ON public.certificates;
DROP POLICY IF EXISTS "Delete own certificates" ON public.certificates;
DROP POLICY IF EXISTS "Read own certificates" ON public.certificates;
CREATE POLICY "Read own or admin certificates" ON public.certificates FOR SELECT TO authenticated
  USING (public_id IS NOT NULL AND (owner_id = auth.uid() OR public.is_admin()));

CREATE OR REPLACE FUNCTION public.next_certificate_no()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT lpad((CASE WHEN is_called THEN last_value + 1 ELSE last_value END)::text, 8, '0') FROM public.certificate_no_seq
$$;

CREATE OR REPLACE FUNCTION public.submit_certificate(p_data jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cost integer;
  v_balance integer;
  v_no text;
  v_public text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT value INTO v_cost FROM public.settings WHERE key = 'cost_per_certificate';
  v_cost := COALESCE(v_cost, 1);
  SELECT token_balance INTO v_balance FROM public.profiles WHERE user_id = v_uid FOR UPDATE;
  IF v_balance IS NULL OR v_balance < v_cost THEN RAISE EXCEPTION 'INSUFFICIENT_TOKENS'; END IF;
  v_no := lpad(nextval('public.certificate_no_seq')::text, 8, '0');
  v_public := translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/', '-_');
  UPDATE public.profiles SET token_balance = token_balance - v_cost,
    union_name_and_no = COALESCE(p_data->>'union', union_name_and_no),
    upazila = COALESCE(p_data->>'upazila', upazila),
    district = COALESCE(p_data->>'district', district),
    ward_member_no = COALESCE(p_data->>'ward', ward_member_no),
    chairman_name = COALESCE(p_data->>'signer', chairman_name)
  WHERE user_id = v_uid;
  INSERT INTO public.token_transactions (user_id, amount, type, note, created_by)
  VALUES (v_uid, -v_cost, 'certificate', 'সনদ নং ' || v_no, v_uid);
  INSERT INTO public.certificates (owner_id, is_template, data, public_id, certificate_no, tokens_charged)
  VALUES (v_uid, false, p_data, v_public, v_no, v_cost);
  RETURN v_public;
END $$;

CREATE OR REPLACE FUNCTION public.admin_adjust_tokens(p_user uuid, p_mode text, p_amount integer, p_note text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old integer; v_new integer;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF p_amount IS NULL OR p_amount < 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  SELECT token_balance INTO v_old FROM public.profiles WHERE user_id = p_user FOR UPDATE;
  IF v_old IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;
  v_new := CASE p_mode WHEN 'add' THEN v_old + p_amount WHEN 'remove' THEN GREATEST(0, v_old - p_amount) WHEN 'set' THEN p_amount ELSE NULL END;
  IF v_new IS NULL THEN RAISE EXCEPTION 'Invalid mode'; END IF;
  UPDATE public.profiles SET token_balance = v_new WHERE user_id = p_user;
  INSERT INTO public.token_transactions (user_id, amount, type, note, created_by)
  VALUES (p_user, v_new - v_old, 'admin_adjust', COALESCE(p_note, ''), auth.uid());
  RETURN v_new;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_cost(p_cost integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF p_cost IS NULL OR p_cost < 0 THEN RAISE EXCEPTION 'Invalid cost'; END IF;
  INSERT INTO public.settings (key, value) VALUES ('cost_per_certificate', p_cost)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  RETURN p_cost;
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (user_id uuid, full_name text, email text, token_balance integer, role text, certificate_count bigint, last_certificate_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
  SELECT p.user_id, p.full_name, u.email::text, p.token_balance,
    CASE WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.user_id AND r.role = 'admin') THEN 'admin' ELSE 'user' END,
    (SELECT count(*) FROM public.certificates c WHERE c.owner_id = p.user_id AND c.public_id IS NOT NULL),
    (SELECT max(c.created_at) FROM public.certificates c WHERE c.owner_id = p.user_id AND c.public_id IS NOT NULL)
  FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
  ORDER BY p.created_at;
END $$;

CREATE OR REPLACE FUNCTION public.get_certificate_by_public_id(p_public_id text)
RETURNS TABLE (public_id text, certificate_no text, data jsonb, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.public_id, c.certificate_no, c.data, c.created_at FROM public.certificates c
  WHERE c.public_id = p_public_id AND p_public_id IS NOT NULL LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.submit_certificate(jsonb), public.admin_adjust_tokens(uuid, text, integer, text), public.admin_set_cost(integer), public.admin_list_users(), public.next_certificate_no(), public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_certificate(jsonb), public.admin_adjust_tokens(uuid, text, integer, text), public.admin_set_cost(integer), public.admin_list_users(), public.next_certificate_no(), public.is_admin() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_certificate_by_public_id(text) TO anon, authenticated;
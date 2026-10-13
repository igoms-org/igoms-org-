-- QR display IDs are independent of certificate numbers and public verification tokens.
-- Existing certificates are deliberately not rewritten.
INSERT INTO public.settings (key, value) VALUES ('next_qr_id', 2156)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.next_qr_id()
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  RETURN (SELECT value FROM public.settings WHERE key = 'next_qr_id');
END $$;
REVOKE EXECUTE ON FUNCTION public.next_qr_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_qr_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_certificate(p_data jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cost integer;
  v_balance integer;
  v_no text;
  v_public text;
  v_qr_id integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  -- Reject bad data before allocating a number or changing balances.
  IF NOT public.is_valid_family_form(p_data) THEN RAISE EXCEPTION 'INVALID_CERTIFICATE_DATA'; END IF;
  SELECT value INTO v_cost FROM public.settings WHERE key = 'cost_per_certificate';
  v_cost := COALESCE(v_cost, 1);
  SELECT token_balance INTO v_balance FROM public.profiles WHERE user_id = v_uid FOR UPDATE;
  IF v_balance IS NULL OR v_balance < v_cost THEN RAISE EXCEPTION 'INSUFFICIENT_TOKENS'; END IF;
  v_no := lpad(nextval('public.certificate_no_seq')::text, 8, '0');
  v_public := translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/', '-_');
  -- The counter row serializes allocations and rolls back with a failed submission.
  UPDATE public.settings SET value = value + 1 WHERE key = 'next_qr_id' RETURNING value - 1 INTO v_qr_id;
  IF v_qr_id IS NULL THEN RAISE EXCEPTION 'QR_COUNTER_UNAVAILABLE'; END IF;
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
  VALUES (v_uid, false, jsonb_set(p_data, '{qrId}', to_jsonb(v_qr_id)), v_public, v_no, v_cost);
  RETURN v_public;
END $$;
REVOKE EXECUTE ON FUNCTION public.submit_certificate(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_certificate(jsonb) TO authenticated;

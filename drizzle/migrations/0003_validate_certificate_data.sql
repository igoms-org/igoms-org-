-- Direct RPC callers must meet the same requirements as the form.
CREATE OR REPLACE FUNCTION public.is_valid_family_form(p_data jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  v_key text;
  v_text text;
  v_member jsonb;
  v_issue date;
  v_birth date;
BEGIN
  IF jsonb_typeof(p_data) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
  FOREACH v_key IN ARRAY ARRAY['applicantName', 'father', 'mother', 'village', 'house', 'union', 'upazila', 'district', 'signer'] LOOP
    IF jsonb_typeof(p_data->v_key) IS DISTINCT FROM 'string' THEN RETURN false; END IF;
    v_text := regexp_replace(p_data->>v_key, '^[[:space:]]+|[[:space:]]+$', '', 'g');
    IF length(v_text) NOT BETWEEN 1 AND 200 THEN RETURN false; END IF;
  END LOOP;
  FOREACH v_key IN ARRAY ARRAY['applicantReg', 'remarks', 'ward', 'wardNo', 'issueDate'] LOOP
    IF jsonb_typeof(p_data->v_key) IS DISTINCT FROM 'string' THEN RETURN false; END IF;
  END LOOP;
  IF length(btrim(p_data->>'applicantReg')) > 100
    OR length(btrim(p_data->>'remarks')) > 1000
    OR length(btrim(p_data->>'ward')) > 20
    OR btrim(p_data->>'wardNo') !~ '^[0-9]{1,3}$'
    OR p_data->>'issueDate' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  THEN RETURN false; END IF;
  v_issue := (p_data->>'issueDate')::date;
  IF jsonb_typeof(p_data->'members') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(p_data->'members') NOT BETWEEN 1 AND 40 THEN RETURN false; END IF;
  IF p_data #>> '{members,0,relation}' IS DISTINCT FROM 'নিজ' THEN RETURN false; END IF;
  FOR v_member IN SELECT value FROM jsonb_array_elements(p_data->'members') LOOP
    IF jsonb_typeof(v_member) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
    FOREACH v_key IN ARRAY ARRAY['name', 'reg', 'dob', 'relation'] LOOP
      IF jsonb_typeof(v_member->v_key) IS DISTINCT FROM 'string' THEN RETURN false; END IF;
    END LOOP;
    IF length(regexp_replace(v_member->>'name', '^[[:space:]]+|[[:space:]]+$', '', 'g')) NOT BETWEEN 1 AND 200
      OR length(btrim(v_member->>'reg')) > 100
      OR v_member->>'relation' NOT IN ('নিজ', 'পুত্র', 'কন্যা', 'স্ত্রী', 'স্বামী', 'পিতা', 'মাতা', 'ভাই', 'বোন')
      OR v_member->>'dob' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    THEN RETURN false; END IF;
    v_birth := (v_member->>'dob')::date;
    IF v_birth > v_issue THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
  RETURN false;
END $$;
REVOKE EXECUTE ON FUNCTION public.is_valid_family_form(jsonb) FROM PUBLIC, anon, authenticated;

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
  -- Reject bad data before allocating a number or changing balances.
  IF NOT public.is_valid_family_form(p_data) THEN RAISE EXCEPTION 'INVALID_CERTIFICATE_DATA'; END IF;
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
REVOKE EXECUTE ON FUNCTION public.submit_certificate(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_certificate(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_next_certificate_no(p_next bigint)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_max bigint;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF p_next IS NULL OR p_next < 1 OR p_next > 99999999 THEN RAISE EXCEPTION 'Invalid number'; END IF;
  SELECT COALESCE(max(certificate_no::bigint), 0) INTO v_max FROM public.certificates WHERE certificate_no ~ '^[0-9]+$';
  IF p_next <= v_max THEN RAISE EXCEPTION 'NUMBER_USED'; END IF;
  PERFORM setval('public.certificate_no_seq', p_next, false);
  RETURN lpad(p_next::text, 8, '0');
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_set_next_certificate_no(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_next_certificate_no(bigint) TO authenticated;
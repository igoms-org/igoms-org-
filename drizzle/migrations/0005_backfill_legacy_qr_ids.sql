-- Assign independent QR IDs to older certificates without renumbering certificates.
CREATE OR REPLACE FUNCTION public.admin_backfill_qr_ids()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_certificate record;
  v_qr_id integer;
  v_count integer := 0;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  -- Lock the same counter used by submissions to prevent duplicate allocations.
  SELECT value INTO v_qr_id FROM public.settings WHERE key = 'next_qr_id' FOR UPDATE;
  IF v_qr_id IS NULL THEN RAISE EXCEPTION 'QR_COUNTER_UNAVAILABLE'; END IF;
  FOR v_certificate IN
    SELECT id FROM public.certificates
    WHERE public_id IS NOT NULL AND NOT (data ? 'qrId')
    ORDER BY created_at, id FOR UPDATE
  LOOP
    UPDATE public.certificates SET data = jsonb_set(data, '{qrId}', to_jsonb(v_qr_id))
    WHERE id = v_certificate.id;
    v_qr_id := v_qr_id + 1;
    v_count := v_count + 1;
  END LOOP;
  UPDATE public.settings SET value = v_qr_id WHERE key = 'next_qr_id';
  RETURN v_count;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_backfill_qr_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_backfill_qr_ids() TO authenticated;

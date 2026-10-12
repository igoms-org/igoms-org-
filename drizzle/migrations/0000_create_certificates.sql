CREATE TABLE public.certificates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid,
 is_template boolean NOT NULL DEFAULT false,
 data jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT certificate_ownership CHECK ((is_template AND owner_id IS NULL) OR (NOT is_template AND owner_id IS NOT NULL))
);
GRANT SELECT ON public.certificates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificates TO authenticated;
GRANT ALL ON public.certificates TO service_role;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read reference template" ON public.certificates FOR SELECT TO anon, authenticated USING (is_template);
CREATE POLICY "Read own certificates" ON public.certificates FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Create own certificates" ON public.certificates FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND NOT is_template);
CREATE POLICY "Update own certificates" ON public.certificates FOR UPDATE TO authenticated USING (owner_id = auth.uid() AND NOT is_template) WITH CHECK (owner_id = auth.uid() AND NOT is_template);
CREATE POLICY "Delete own certificates" ON public.certificates FOR DELETE TO authenticated USING (owner_id = auth.uid() AND NOT is_template);
CREATE INDEX certificates_owner_created_idx ON public.certificates(owner_id, created_at DESC);
INSERT INTO public.certificates (id, is_template, data) VALUES ('00000000-0000-4000-8000-000000007298', true, '{"referenceId":"7298","number":"00001687","date":"25-07-2026","union":"০২ নং বহরপুর","upazila":"বালিয়াকান্দি","district":"রাজবাড়ী","subject":"মোঃ আক্তার মৃধা","nationalId":"-","father":"মোঃ আঃ কাদের মৃধা","mother":"মোছাঃ সাজেদা বেগম","village":"তেতুলিয়া","ward":"04","house":"00-00-0000-00","comment":"-","signer":"মোঃ রেজাউল করিম","designation":"","members":[{"name":"মোঃ আক্তার মৃধা (৬৮৫২০৮৯৬২৯)","birthDate":"01-02-1978","age":48,"relation":"নিজ"},{"name":"মোঃ জাহিদুল ইসলাম সানি (২৪২৪৬৩৬২৭৮)","birthDate":"11-12-2004","age":21,"relation":"পুত্র"},{"name":"সুইটি আক্তার তমা (৩৭৬২৫৪৭০১০)","birthDate":"02-12-2000","age":25,"relation":"কন্যা"},{"name":"মোছাঃ জুলেখা খাতুন (৯১৪২৬৬০১৮৩)","birthDate":"01-01-1985","age":41,"relation":"স্ত্রী"}]}');
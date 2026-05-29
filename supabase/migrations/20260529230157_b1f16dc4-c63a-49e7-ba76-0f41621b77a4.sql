DROP POLICY IF EXISTS "Usuarios ven sus campañas" ON public.lead_recovery_campaigns;

CREATE POLICY "Admins read own campaigns" ON public.lead_recovery_campaigns
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND auth.uid() = user_id);

CREATE POLICY "Admins insert own campaigns" ON public.lead_recovery_campaigns
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND auth.uid() = user_id);

CREATE POLICY "Admins update own campaigns" ON public.lead_recovery_campaigns
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND auth.uid() = user_id)
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND auth.uid() = user_id);

CREATE POLICY "Admins delete own campaigns" ON public.lead_recovery_campaigns
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND auth.uid() = user_id);
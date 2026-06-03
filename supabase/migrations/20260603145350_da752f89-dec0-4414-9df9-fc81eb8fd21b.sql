INSERT INTO public.lead_tags (id, nombre, color) VALUES
  ('2e9855a0-0525-478b-9ef5-39e8bf98d642','Seguimiento','#7c3aed'),
  ('1cc3645a-af05-49b1-b323-343f8887e98a','Reunion Agendada Agente IA','#0d9488'),
  ('3a0f5f02-bb2d-438c-942f-e717d736d90f','Agente Asignado','#cc0000'),
  ('e063fe02-6c55-4024-a8c2-049fe1481719','a la espera de agendamiento (interesado)','#ea580c')
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, color = EXCLUDED.color;
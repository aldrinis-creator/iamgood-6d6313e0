DELETE FROM public.medication_logs ml
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = ml.user_id);

DELETE FROM public.medications m
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = m.user_id);
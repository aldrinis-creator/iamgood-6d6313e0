ALTER TABLE public.guardians DISABLE TRIGGER guardians_prevent_ward_status_change;
ALTER TABLE public.guardians DISABLE TRIGGER prevent_guardian_self_approval_trg;
ALTER TABLE public.guardians DISABLE TRIGGER trg_prevent_guardian_self_approval;

UPDATE public.guardians
SET status = 'pending',
    nominated_at = now(),
    nomination_expires_at = now() + interval '7 days',
    reminder_count = 0,
    ward_notified_unaccepted = false
WHERE id = '72538f64-b99a-465f-b554-d94a8764b2e2';

ALTER TABLE public.guardians ENABLE TRIGGER trg_prevent_guardian_self_approval;
ALTER TABLE public.guardians ENABLE TRIGGER prevent_guardian_self_approval_trg;
ALTER TABLE public.guardians ENABLE TRIGGER guardians_prevent_ward_status_change;

-- Check-ins table
CREATE TABLE public.check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  responded_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'responded', 'missed', 'escalated')),
  response TEXT CHECK (response IN ('ok', 'not_ok', NULL)),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_check_ins_user_status ON public.check_ins (user_id, status);
CREATE INDEX idx_check_ins_scheduled ON public.check_ins (scheduled_at);

CREATE POLICY "Users can view their own check-ins" ON public.check_ins FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own check-ins" ON public.check_ins FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own check-ins" ON public.check_ins FOR UPDATE USING (auth.uid() = user_id);
-- Guardians can view their ward's check-ins
CREATE POLICY "Guardians can view ward check-ins" ON public.check_ins FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.guardians g WHERE g.guardian_phone IN (
    SELECT phone FROM public.profiles WHERE id = auth.uid()
  ) AND g.user_id = check_ins.user_id)
);

-- SOS events table
CREATE TABLE public.sos_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  triggered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'resolved')),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  trigger_type TEXT NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('manual', 'fall_detection', 'inactivity', 'missed_checkin')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sos_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_sos_events_user ON public.sos_events (user_id, status);

CREATE POLICY "Users can view their own SOS events" ON public.sos_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own SOS events" ON public.sos_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own SOS events" ON public.sos_events FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Guardians can view ward SOS events" ON public.sos_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.guardians g WHERE g.guardian_phone IN (
    SELECT phone FROM public.profiles WHERE id = auth.uid()
  ) AND g.user_id = sos_events.user_id)
);

-- Medical records table
CREATE TABLE public.medical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  record_type TEXT NOT NULL CHECK (record_type IN ('prescription', 'lab_report', 'discharge_summary', 'insurance', 'id_card', 'vaccination', 'other')),
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  file_name TEXT,
  doctor_name TEXT,
  hospital_name TEXT,
  record_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_medical_records_user ON public.medical_records (user_id, record_type);

CREATE POLICY "Users can view their own medical records" ON public.medical_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own medical records" ON public.medical_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own medical records" ON public.medical_records FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own medical records" ON public.medical_records FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_medical_records_updated_at
  BEFORE UPDATE ON public.medical_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Medical conditions / health profile
CREATE TABLE public.health_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  blood_group TEXT,
  allergies TEXT[],
  chronic_conditions TEXT[],
  current_medications TEXT[],
  emergency_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.health_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own health profile" ON public.health_profile FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own health profile" ON public.health_profile FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own health profile" ON public.health_profile FOR UPDATE USING (auth.uid() = user_id);
-- Guardians can view ward health profile for emergencies
CREATE POLICY "Guardians can view ward health profile" ON public.health_profile FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.guardians g WHERE g.guardian_phone IN (
    SELECT phone FROM public.profiles WHERE id = auth.uid()
  ) AND g.user_id = health_profile.user_id)
);

CREATE TRIGGER update_health_profile_updated_at
  BEFORE UPDATE ON public.health_profile
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for medical documents
INSERT INTO storage.buckets (id, name, public) VALUES ('medical-documents', 'medical-documents', false);

CREATE POLICY "Users can upload their own medical docs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'medical-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view their own medical docs" ON storage.objects FOR SELECT USING (bucket_id = 'medical-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own medical docs" ON storage.objects FOR DELETE USING (bucket_id = 'medical-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

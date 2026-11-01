-- Check-iN: My Digital Legacy (After-Life Messages for Loved Ones)

CREATE TABLE IF NOT EXISTS public.digital_legacy_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255) NOT NULL,
    recipient_relation VARCHAR(100),
    media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('text', 'audio', 'video')),
    content_text TEXT,
    media_url TEXT,
    is_released BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.digital_legacy_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own digital legacy"
    ON public.digital_legacy_messages
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Nominees can view released legacy messages"
    ON public.digital_legacy_messages
    FOR SELECT
    TO authenticated
    USING (
        is_released = true AND
        EXISTS (
            SELECT 1 FROM public.guardians g
            WHERE g.guardian_user_id = auth.uid()
              AND g.user_id = digital_legacy_messages.user_id
              AND g.status = 'accepted'
        )
    );

CREATE INDEX IF NOT EXISTS idx_digital_legacy_user ON public.digital_legacy_messages(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.digital_legacy_messages TO authenticated;
GRANT ALL ON public.digital_legacy_messages TO service_role;
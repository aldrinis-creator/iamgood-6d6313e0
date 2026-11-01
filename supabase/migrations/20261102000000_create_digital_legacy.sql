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

-- Row Level Security
ALTER TABLE public.digital_legacy_messages ENABLE ROW LEVEL SECURITY;

-- 1. Users have complete access to create, edit, delete, view their own legacy messages
CREATE POLICY "Users can manage their own digital legacy"
    ON public.digital_legacy_messages
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 2. Guardians CANNOT view the actual message content while user is active.
-- However, verified release is handled server-side via the Vault Claim release token,
-- or once marked is_released = true upon approved claim.
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

CREATE INDEX idx_digital_legacy_user ON public.digital_legacy_messages(user_id);

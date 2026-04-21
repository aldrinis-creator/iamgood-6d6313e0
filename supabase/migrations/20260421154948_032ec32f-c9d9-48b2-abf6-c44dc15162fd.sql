-- Journey share tokens table
CREATE TABLE public.journey_share_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES public.journeys(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX idx_journey_share_tokens_journey ON public.journey_share_tokens(journey_id);
CREATE INDEX idx_journey_share_tokens_token ON public.journey_share_tokens(token);

ALTER TABLE public.journey_share_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own share tokens"
ON public.journey_share_tokens
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Public RPC: returns live tracking only while journey is active
CREATE OR REPLACE FUNCTION public.get_public_journey(_token text)
RETURNS TABLE(
  destination_name text,
  destination_lat double precision,
  destination_lng double precision,
  transport_mode text,
  started_at timestamp with time zone,
  status text,
  current_lat double precision,
  current_lng double precision,
  updated_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH tok AS (
    SELECT t.journey_id
    FROM public.journey_share_tokens t
    WHERE t.token = _token
      AND t.expires_at > now()
    LIMIT 1
  ),
  j AS (
    SELECT j.*
    FROM public.journeys j
    JOIN tok ON tok.journey_id = j.id
    WHERE j.status = 'active'
  ),
  last_upd AS (
    SELECT u.lat, u.lng, u.created_at
    FROM public.journey_updates u
    JOIN j ON j.id = u.journey_id
    WHERE u.lat IS NOT NULL AND u.lng IS NOT NULL
    ORDER BY u.created_at DESC
    LIMIT 1
  )
  SELECT
    j.destination_name,
    j.destination_lat,
    j.destination_lng,
    j.transport_mode,
    j.started_at,
    j.status,
    last_upd.lat AS current_lat,
    last_upd.lng AS current_lng,
    last_upd.created_at AS updated_at
  FROM j
  LEFT JOIN last_upd ON true;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_journey(text) TO anon, authenticated;
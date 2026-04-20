import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TRIAL_DAYS = 7

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  // Validate caller
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const token = authHeader.replace('Bearer ', '')
  const { data: claims, error: claimsError } = await authClient.auth.getClaims(token)
  if (claimsError || !claims?.claims?.sub) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const userId = claims.claims.sub as string
  const userEmail = (claims.claims.email as string | undefined) ?? null

  const admin = createClient(supabaseUrl, serviceKey)

  // 1. Check trial already used
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('trial_started_at, full_name, role')
    .eq('id', userId)
    .maybeSingle()

  if (profileError) {
    return new Response(JSON.stringify({ error: 'Failed to load profile' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (profile?.trial_started_at) {
    return new Response(JSON.stringify({ error: 'Free trial already used on this account.' }), {
      status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 2. Check no active subscription
  const { data: existing } = await admin
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gte('expires_at', new Date().toISOString())
    .limit(1)
    .maybeSingle()
  if (existing) {
    return new Response(JSON.stringify({ error: 'You already have an active subscription.' }), {
      status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 3. Insert trial subscription
  const startsAt = new Date()
  const expiresAt = new Date(startsAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000)

  const { data: sub, error: insertError } = await admin
    .from('subscriptions')
    .insert({
      user_id: userId,
      plan_type: 'pro',
      billing_cycle: 'trial',
      status: 'active',
      is_trial: true,
      amount_paise: 0,
      starts_at: startsAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single()

  if (insertError) {
    console.error('Failed to insert trial', insertError)
    return new Response(JSON.stringify({ error: 'Failed to start trial' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 4. Mark trial used on profile
  await admin
    .from('profiles')
    .update({ trial_started_at: startsAt.toISOString() })
    .eq('id', userId)

  // 5. Best-effort welcome email (non-blocking on failure)
  if (userEmail && !userEmail.endsWith('@phone.checkin.app')) {
    try {
      await admin.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'trial-started',
          recipientEmail: userEmail,
          idempotencyKey: `trial-started-${sub.id}`,
          templateData: {
            name: profile?.full_name || '',
            expiresAt: expiresAt.toISOString(),
          },
        },
      })
    } catch (e) {
      console.error('Trial email send failed (non-fatal)', e)
    }
  }

  return new Response(
    JSON.stringify({ success: true, subscription: sub }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})

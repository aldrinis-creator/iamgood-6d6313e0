// Fetches openFDA drug label + RxNorm normalized name for a given drug.
// Public, keyless APIs. Soft-fail per source.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';

const BodySchema = z.object({ drug: z.string().min(1).max(100) });

async function fetchWithTimeout(url: string, ms = 8000): Promise<Response | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    return r;
  } catch (e) {
    console.warn('fetch failed', url, (e as Error).message);
    return null;
  } finally {
    clearTimeout(t);
  }
}

function pickFirst<T>(arr: T[] | undefined): T | undefined {
  return Array.isArray(arr) && arr.length ? arr[0] : undefined;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: 'Invalid input' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const drug = parsed.data.drug.trim();
    const enc = encodeURIComponent(drug);

    const rxnormUrl = `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${enc}&search=2`;
    const fdaUrl = `https://api.fda.gov/drug/label.json?search=openfda.generic_name:%22${enc}%22+openfda.brand_name:%22${enc}%22&limit=1`;

    const [rxRes, fdaRes] = await Promise.all([
      fetchWithTimeout(rxnormUrl),
      fetchWithTimeout(fdaUrl),
    ]);

    let rxnorm: { rxcui: string; name: string } | null = null;
    if (rxRes?.ok) {
      try {
        const j = await rxRes.json();
        const rxcui = j?.idGroup?.rxnormId?.[0];
        if (rxcui) rxnorm = { rxcui, name: j.idGroup.name || drug };
      } catch { /* ignore */ }
    }

    let fda: Record<string, string> | null = null;
    if (fdaRes?.ok) {
      try {
        const j = await fdaRes.json();
        const r = pickFirst(j.results);
        if (r) {
          const of = r.openfda || {};
          fda = {
            brand_name: pickFirst<string>(of.brand_name) || '',
            generic_name: pickFirst<string>(of.generic_name) || '',
            manufacturer: pickFirst<string>(of.manufacturer_name) || '',
            indications_and_usage: pickFirst<string>(r.indications_and_usage) || '',
            dosage_and_administration: pickFirst<string>(r.dosage_and_administration) || '',
            warnings: pickFirst<string>(r.warnings) || pickFirst<string>(r.warnings_and_cautions) || '',
            adverse_reactions: pickFirst<string>(r.adverse_reactions) || '',
            contraindications: pickFirst<string>(r.contraindications) || '',
            pregnancy: pickFirst<string>(r.pregnancy) || '',
            effective_time: r.effective_time || '',
          };
          // strip empty keys
          Object.keys(fda).forEach((k) => { if (!fda![k]) delete fda![k]; });
          if (Object.keys(fda).length === 0) fda = null;
        }
      } catch { /* ignore */ }
    }

    return new Response(
      JSON.stringify({
        rxnorm,
        fda,
        sources: {
          rxnorm_url: 'https://rxnav.nlm.nih.gov/',
          fda_url: 'https://open.fda.gov/apis/drug/label/',
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ShieldCheck } from "lucide-react";

type AuthorizationDetails = {
  client?: { name?: string; client_uri?: string; logo_uri?: string } | null;
  redirect_url?: string;
  redirect_to?: string;
  scopes?: string[];
};

// Local typed wrapper — supabase.auth.oauth is beta and may be missing from types.
function oauthApi() {
  return (supabase.auth as unknown as {
    oauth: {
      getAuthorizationDetails: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
      approveAuthorization: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
      denyAuthorization: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
    };
  }).oauth;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Missing authorization_id");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      try {
        const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
        if (!active) return;
        if (error) return setError(error.message);
        const immediate = data?.redirect_url ?? data?.redirect_to;
        if (immediate && !data?.client) {
          window.location.href = immediate;
          return;
        }
        setDetails(data);
      } catch (e: any) {
        setError(e?.message ?? "Could not load authorization request.");
      }
    })();
    return () => { active = false; };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    try {
      const api = oauthApi();
      const { data, error } = approve
        ? await api.approveAuthorization(authorizationId)
        : await api.denyAuthorization(authorizationId);
      if (error) { setBusy(false); return setError(error.message); }
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) { setBusy(false); return setError("No redirect returned by the authorization server."); }
      window.location.href = target;
    } catch (e: any) {
      setBusy(false);
      setError(e?.message ?? "Could not complete authorization.");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 space-y-4">
          {error ? (
            <>
              <h1 className="text-lg font-semibold text-destructive">Authorization error</h1>
              <p className="text-sm text-muted-foreground">{error}</p>
            </>
          ) : !details ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading authorization…
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                <h1 className="text-lg font-semibold">
                  Connect {details.client?.name ?? "this app"} to Check-iN
                </h1>
              </div>
              <p className="text-sm text-muted-foreground">
                {details.client?.name ?? "The requesting app"} is asking to use your Check-iN account to read
                your medications, appointments, and health status through the Check-iN agent tools. Only approve
                if you recognize and trust this app.
              </p>
              <div className="flex gap-2 pt-2">
                <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Approve"}
                </Button>
                <Button className="flex-1" variant="outline" disabled={busy} onClick={() => decide(false)}>
                  Deny
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

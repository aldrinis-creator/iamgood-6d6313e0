import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, Share, Plus, MoreVertical, ShieldCheck } from "lucide-react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import usePwaInstall from "@/hooks/usePwaInstall";
import AppLayout from "@/components/AppLayout";
import SeoMeta from "@/components/SeoMeta";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { clearPendingNomination, stashNominationToken } from "@/lib/pendingNomination";
import { useEffect } from "react";

const Install = () => {
  const { canInstall, installApp, isInstalled } = usePwaInstall();
  const [searchParams] = useSearchParams();
  const guardianToken = searchParams.get("g");
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Survive the PWA install (start_url is "/", which drops the token).
  useEffect(() => {
    stashNominationToken(guardianToken);
  }, [guardianToken]);

  useEffect(() => {
    if (authLoading || !session || !guardianToken) return;
    const acceptExisting = async () => {
      try {
        await supabase.rpc("link_guardian_user_id");
        await supabase.functions.invoke("guardian-nomination-response", { body: { token: guardianToken, action: "accept" } });
        clearPendingNomination();
        toast.success("Guardian invitation accepted successfully!");
        navigate("/guardian");
      } catch (e) {
        console.error(e);
      }
    };
    acceptExisting();
  }, [guardianToken, session, authLoading, navigate]);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  return (
    <AppLayout>
      <SeoMeta
        title={guardianToken ? "Set up your Guardian account" : "Install Check-iN"}
        description="Install Check-iN as a PWA on your phone for instant access to India's medication reminder, elderly care & emergency alert app. Works offline with push notifications."
        canonicalPath="/install"
      />
      <div className="p-4 space-y-6">
        <div className="text-center space-y-2">
          {guardianToken ? (
            <ShieldCheck className="w-12 h-12 mx-auto text-primary" />
          ) : (
            <Smartphone className="w-12 h-12 mx-auto text-primary" />
          )}
          <h1 className="text-2xl font-bold text-foreground">
            {guardianToken ? "Set up your Guardian account" : "Install Check-iN"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {guardianToken
              ? "You've been nominated as a Guardian on Check-iN. Accept your nomination first — this creates your Guardian account, not a regular user account."
              : "Add Check-iN to your home screen for instant access, offline support, and push notifications."}
          </p>
        </div>

        {guardianToken && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                <p className="text-sm font-semibold text-foreground">Step 1 — Accept your nomination</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Tap below to accept and create your Guardian account. You'll start receiving your ward's check-in, medication and SOS alerts.
              </p>
              <Button asChild className="w-full h-12 text-base font-semibold">
                <Link to={`/register?nomination=accept&token=${guardianToken}`}>
                  Accept &amp; Create Guardian Account
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link to={`/register?nomination=reject&token=${guardianToken}`}>Reject nomination</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {guardianToken && (
          <p className="text-center text-sm font-semibold text-foreground">
            Step 2 — Add the app to your home screen
          </p>
        )}



        {isInstalled && (
          <Card className="border-success/30 bg-success/5">
            <CardContent className="pt-6 text-center">
              <p className="text-success font-semibold">✓ Check-iN is already installed!</p>
            </CardContent>
          </Card>
        )}

        {canInstall && (
          <Button onClick={installApp} className="w-full h-12 text-base font-semibold gap-2">
            <Download className="w-5 h-5" /> Install Now
          </Button>
        )}

        {isIOS && !isInstalled && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Install on iPhone / iPad</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Share className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">1. Tap the Share button</p>
                  <p className="text-xs text-muted-foreground">At the bottom of Safari (square with arrow)</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Plus className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">2. Tap "Add to Home Screen"</p>
                  <p className="text-xs text-muted-foreground">Scroll down in the share sheet to find it</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Download className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">3. Tap "Add"</p>
                  <p className="text-xs text-muted-foreground">Check-iN will appear on your home screen</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!isIOS && !canInstall && !isInstalled && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Install on Android</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <MoreVertical className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">1. Tap the menu (⋮)</p>
                  <p className="text-xs text-muted-foreground">Top-right corner of Chrome</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Download className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">2. Tap "Install app" or "Add to Home screen"</p>
                  <p className="text-xs text-muted-foreground">Then confirm the installation</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default Install;

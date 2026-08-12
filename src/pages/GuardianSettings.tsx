import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bell, Moon, Users, Globe, Shield, Crown, ShieldCheck, AlertCircle, FileLock2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/sonner";
import usePushSubscription from "@/hooks/usePushSubscription";
import { useSubscription } from "@/hooks/useSubscription";
import { getGuardianLimit } from "@/lib/featureGating";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import VaultClaimCard from "@/components/vault/VaultClaimCard";
import { useVaultClaimStatus, ACTIVE_CLAIM_STATUSES } from "@/components/vault/useVaultClaimStatus";
import { formatDistanceToNow } from "date-fns";

type Tab = "profile" | "wards" | "notifications" | "quiet" | "language" | "privacy";

interface WardRow {
  id: string;
  user_id: string;
  is_primary: boolean;
  relation: string | null;
  status: string;
  ward_name: string;
}

const QUIET_KEY = "guardian_quiet_hours";
const NOTIF_KEY = "guardian_notif_prefs";
const LANG_KEY = "guardian_language";

interface QuietHours {
  enabled: boolean;
  from: string;
  to: string;
}
interface NotifPrefs {
  push: boolean;
  email: boolean;
  whatsapp: boolean;
  pop_missed_events: boolean;
  cat_sos: boolean;
  cat_missed_checkin: boolean;
  cat_low_battery: boolean;
  cat_medication: boolean;
  cat_geofence: boolean;
  cat_journey: boolean;
}

const defaultQuiet: QuietHours = { enabled: false, from: "22:00", to: "07:00" };
const defaultNotif: NotifPrefs = {
  push: true, email: true, whatsapp: true, pop_missed_events: true,
  cat_sos: true, cat_missed_checkin: true, cat_low_battery: true,
  cat_medication: true, cat_geofence: true, cat_journey: true,
};

const loadJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch { return fallback; }
};

const GuardianSettings = () => {
  const { session, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [wards, setWards] = useState<WardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [ecName, setEcName] = useState("");
  const [ecPhone, setEcPhone] = useState("");
  const [ecRelation, setEcRelation] = useState("");
  const { isSubscribed, supported, subscribe, unsubscribe } = usePushSubscription();
  const { plan } = useSubscription();
  const [quiet, setQuiet] = useState<QuietHours>(() => loadJson(QUIET_KEY, defaultQuiet));
  const [notif, setNotif] = useState<NotifPrefs>(() => loadJson(NOTIF_KEY, defaultNotif));
  const [language, setLanguage] = useState<string>(() => localStorage.getItem(LANG_KEY) || "en");

  useEffect(() => { localStorage.setItem(QUIET_KEY, JSON.stringify(quiet)); }, [quiet]);
  useEffect(() => { localStorage.setItem(NOTIF_KEY, JSON.stringify(notif)); }, [notif]);
  useEffect(() => { localStorage.setItem(LANG_KEY, language); }, [language]);

  useEffect(() => {
    if (!session?.user?.id) return;
    setProfileName(profile?.full_name || "");
    setProfilePhone(profile?.phone || "");
    setAvatarUrl((profile as any)?.avatar_url || "");
    setEcName((profile as any)?.emergency_contact_name || "");
    setEcPhone((profile as any)?.emergency_contact_phone || "");
    setEcRelation((profile as any)?.emergency_contact_relation || "");
  }, [session?.user?.id, profile]);

  // Fetch wards I monitor
  useEffect(() => {
    if (!session?.user?.id) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      const { data: gRows } = await supabase
        .from("guardians")
        .select("id, user_id, is_primary, relation, status")
        .eq("guardian_user_id", session.user.id)
        .eq("status", "accepted");
      if (!gRows || gRows.length === 0) {
        if (!cancelled) { setWards([]); setLoading(false); }
        return;
      }
      const userIds = gRows.map((g: any) => g.user_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      const merged: WardRow[] = (gRows as any[]).map((g) => ({
        id: g.id,
        user_id: g.user_id,
        is_primary: !!g.is_primary,
        relation: g.relation,
        status: g.status,
        ward_name: profs?.find((p: any) => p.id === g.user_id)?.full_name || "Ward",
      }));
      if (!cancelled) { setWards(merged); setLoading(false); }
    };
    run();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  const saveProfile = async () => {
    if (!session?.user?.id) return;
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profileName.trim(),
        avatar_url: avatarUrl || null,
        emergency_contact_name: ecName.trim() || null,
        emergency_contact_phone: ecPhone.trim() || null,
        emergency_contact_relation: ecRelation.trim() || null,
      } as any)
      .eq("id", session.user.id);
    if (error) toast.error("Could not save profile");
    else toast.success("Profile updated");
  };

  const handleAvatarUpload = async (file: File) => {
    if (!session?.user?.id) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB");
      return;
    }
    setUploadingAvatar(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${session.user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      toast.error("Upload failed");
      setUploadingAvatar(false);
      return;
    }
    setAvatarUrl(path);

    setUploadingAvatar(false);
    toast.success("Photo uploaded — tap Save Profile to keep it");
  };

  const togglePush = async () => {
    if (!supported) { toast.error("Push not supported in this browser"); return; }
    if (isSubscribed) await unsubscribe(); else await subscribe();
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "profile", label: "Profile" },
    { id: "wards", label: "Wards" },
    { id: "notifications", label: "Notifications" },
    { id: "quiet", label: "Quiet Hours" },
    { id: "language", label: "Language" },
    { id: "privacy", label: "Privacy" },
  ];

  const wardLimit = getGuardianLimit(plan);
  const maxWardsForGuardian = 3; // hard cap independent of plan

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-success" />
          <h1 className="text-xl font-bold">Guardian Settings</h1>
        </div>

        <nav className="flex gap-1 overflow-x-auto bg-muted rounded-lg p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {activeTab === "profile" && (
          <Card>
            <CardHeader><CardTitle className="text-base">Your Profile</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-muted overflow-hidden flex items-center justify-center border">
                  <AvatarImage
                    value={avatarUrl}
                    className="w-full h-full object-cover"
                    fallback={<ShieldCheck className="w-7 h-7 text-muted-foreground" />}
                  />

                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Profile photo</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    disabled={uploadingAvatar}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleAvatarUpload(f);
                    }}
                    className="text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Full Name</Label>
                <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={profilePhone} disabled />
                <p className="text-xs text-muted-foreground">Phone is your login identifier and cannot be edited here.</p>
              </div>

              <div className="pt-2 border-t space-y-3">
                <div>
                  <h4 className="text-sm font-semibold">Your Emergency Contact</h4>
                  <p className="text-xs text-muted-foreground">One person to reach if something happens to you. Plain contact info — not encrypted.</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Name</Label>
                  <Input value={ecName} onChange={(e) => setEcName(e.target.value)} placeholder="e.g. Spouse, Sibling" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Phone</Label>
                    <Input value={ecPhone} onChange={(e) => setEcPhone(e.target.value)} placeholder="+91…" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Relation</Label>
                    <Input value={ecRelation} onChange={(e) => setEcRelation(e.target.value)} placeholder="Spouse" />
                  </div>
                </div>
              </div>

              <Button onClick={saveProfile} className="w-full">Save Profile</Button>
            </CardContent>
          </Card>
        )}

        {activeTab === "wards" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Wards You Monitor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-muted-foreground">
                {wards.length} of {maxWardsForGuardian} wards (hard limit per guardian).
              </div>
              {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {!loading && wards.length === 0 && (
                <div className="text-sm text-muted-foreground py-6 text-center">
                  You are not yet monitoring any Ward. Ask them to nominate you from their app.
                </div>
              )}
              {wards.map((w) => (
                <div key={w.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{w.ward_name}</div>
                    {w.is_primary && (
                      <Badge variant="default" className="text-[10px] px-1.5 py-0">You are Primary Guardian</Badge>
                    )}
                  </div>
                  {w.relation && (
                    <div className="text-xs text-muted-foreground">Relation: {w.relation}</div>
                  )}
                  {w.is_primary && (
                    <BereavementSection wardUserId={w.user_id} wardName={w.ward_name} />
                  )}
                </div>
              ))}
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted rounded-md p-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Only the Ward can revoke your guardian access. Ask them to remove you from their Settings → Guardians if needed.</span>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "notifications" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="w-4 h-4 text-warning" />
                Notification Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold mb-2">Channels</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Push notifications</Label>
                    <Switch checked={!!isSubscribed} onCheckedChange={togglePush} disabled={!supported} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Email alerts</Label>
                    <Switch checked={notif.email} onCheckedChange={(v) => setNotif({ ...notif, email: v })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>In-App Pop-ups</Label>
                    <Switch checked={notif.pop_missed_events !== false} onCheckedChange={(v) => setNotif({ ...notif, pop_missed_events: v })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>WhatsApp alerts</Label>
                    <Switch checked={notif.whatsapp} onCheckedChange={(v) => setNotif({ ...notif, whatsapp: v })} />
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2">Categories</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>SOS alerts <span className="text-xs text-muted-foreground">(always on)</span></Label>
                    <Switch checked disabled />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Missed Check-In</Label>
                    <Switch checked={notif.cat_missed_checkin} onCheckedChange={(v) => setNotif({ ...notif, cat_missed_checkin: v })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Low Battery</Label>
                    <Switch checked={notif.cat_low_battery} onCheckedChange={(v) => setNotif({ ...notif, cat_low_battery: v })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Medication Missed</Label>
                    <Switch checked={notif.cat_medication} onCheckedChange={(v) => setNotif({ ...notif, cat_medication: v })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Geofence Exit</Label>
                    <Switch checked={notif.cat_geofence} onCheckedChange={(v) => setNotif({ ...notif, cat_geofence: v })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Journey Deviation</Label>
                    <Switch checked={notif.cat_journey} onCheckedChange={(v) => setNotif({ ...notif, cat_journey: v })} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "quiet" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Moon className="w-4 h-4 text-primary" />
                Quiet Hours
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Enable Quiet Hours</Label>
                <Switch checked={quiet.enabled} onCheckedChange={(v) => setQuiet({ ...quiet, enabled: v })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">From</Label>
                  <Input type="time" value={quiet.from} onChange={(e) => setQuiet({ ...quiet, from: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">To</Label>
                  <Input type="time" value={quiet.to} onChange={(e) => setQuiet({ ...quiet, to: e.target.value })} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground bg-destructive/5 border border-destructive/20 rounded-md p-2">
                <strong>SOS alerts always break through Quiet Hours.</strong> Only routine notifications (low battery, missed check-in, medication, geofence, journey) are deferred.
              </p>
            </CardContent>
          </Card>
        )}

        {activeTab === "language" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                Language
              </CardTitle>
            </CardHeader>
            <CardContent>
              <select
                className="w-full border rounded-md px-3 py-2 bg-background"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="en">English</option>
                <option value="hi">हिन्दी (Hindi)</option>
                <option value="ta">தமிழ் (Tamil)</option>
                <option value="te">తెలుగు (Telugu)</option>
                <option value="bn">বাংলা (Bengali)</option>
                <option value="mr">मराठी (Marathi)</option>
              </select>
            </CardContent>
          </Card>
        )}

        {activeTab === "privacy" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Privacy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>As a Guardian, you have <strong>read-only</strong> access to your Ward's safety and health data shared explicitly via the app. You cannot edit the Ward's settings, medications or documents.</p>
              <p>To request a copy or deletion of <strong>your own</strong> guardian account data, contact support.</p>
              <Button variant="outline" className="w-full" onClick={() => navigate("/contact-us")}>Contact Support</Button>
            </CardContent>
          </Card>
        )}

        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm">
              <Crown className="w-4 h-4 text-warning" />
              <span>Plan: <strong>{plan || "free"}</strong> · {wardLimit} guardian-seats per ward</span>
            </div>
          </CardContent>
        </Card>

        <Button variant="destructive" className="w-full" onClick={async () => { await signOut(); navigate("/login"); }}>
          Log Out
        </Button>
      </div>
    </AppLayout>
  );
};

const STATUS_LABELS: Record<string, string> = {
  initiated: "Initiated",
  docs_uploaded: "Documents uploaded",
  user_window_open: "7-day window open",
  released: "Released",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const BereavementSection = ({ wardUserId, wardName }: { wardUserId: string; wardName: string }) => {
  const [open, setOpen] = useState(false);
  const { loading, eligible, claim } = useVaultClaimStatus(wardUserId);

  const statusLine = (() => {
    if (loading) return "Checking eligibility…";
    if (!eligible) return `${wardName} has not designated you as Vault Nominee. Ask them to enable this in their Vault.`;
    if (!claim) return "No claim filed.";
    const label = STATUS_LABELS[claim.status] || claim.status;
    const when = formatDistanceToNow(new Date(claim.created_at), { addSuffix: true });
    return `${label} · ${when}`;
  })();

  const isActive = !!claim && ACTIVE_CLAIM_STATUSES.includes(claim.status);

  return (
    <div className="mt-2 pt-3 border-t space-y-2">
      <div className="flex items-center gap-2">
        <FileLock2 className="w-4 h-4 text-primary" />
        <div className="text-sm font-semibold">Bereavement / Vault Claim</div>
        {isActive && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">In progress</Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        If the worst should happen, use this to begin the Vault Nominee Claim process and access {wardName}'s essential records.
      </p>
      <div className="text-xs text-muted-foreground">{statusLine}</div>
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        disabled={!eligible}
        onClick={() => setOpen(true)}
      >
        Open Bereavement / Vault Claim
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bereavement / Vault Claim — {wardName}</DialogTitle>
          </DialogHeader>
          <VaultClaimCard wardUserId={wardUserId} wardName={wardName} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GuardianSettings;

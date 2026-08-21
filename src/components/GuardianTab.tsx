import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Trash2, Mail, Lock, RefreshCw, Star } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import PhoneInput from "@/components/PhoneInput";
import { useSubscription } from "@/hooks/useSubscription";
import { getGuardianLimit } from "@/lib/featureGating";
import UpgradeDialog from "@/components/UpgradeDialog";
import { formatDistanceToNow } from "date-fns";

interface Guardian {
  id: string;
  guardian_name: string;
  guardian_phone: string;
  guardian_email: string | null;
  relation: string | null;
  is_primary: boolean;
  status: string;
  nominated_at: string;
}

interface GuardianTabProps {
  userId: string | undefined;
}

const GuardianTab = ({ userId }: GuardianTabProps) => {
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [resending, setResending] = useState<string | null>(null);
  const { plan } = useSubscription();
  const guardianLimit = getGuardianLimit(plan);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [relation, setRelation] = useState("");

  const [primaryCandidate, setPrimaryCandidate] = useState<Guardian | null>(null);
  const [settingPrimary, setSettingPrimary] = useState(false);

  const fetchGuardians = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("guardians")
      .select("id, guardian_name, guardian_phone, guardian_email, relation, is_primary, status, nominated_at")
      .eq("user_id", userId)
      .order("is_primary", { ascending: false });

    if (error) {
      console.error("Error fetching guardians:", error);
    } else {
      setGuardians(data || []);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchGuardians();
  }, [fetchGuardians]);

  const phoneDigitCount = phone.replace(/[^\d]/g, "").length;
  const isPhoneValid = phoneDigitCount >= 10;

  const handleResendInvite = async (g: Guardian) => {
    setResending(g.id);
    try {
      // Must go through resendGuardianInvite so the live nomination_token is
      // included — a tokenless invite sends the plain User install link.
      await resendGuardianInvite(g.id, "Your ward");
    } catch {
      toast.error("Failed to re-send invite");
    }
    setResending(null);
  };


  const handleAdd = async () => {
    if (!userId || !name.trim() || !phone.trim() || !email.trim()) {
      toast.error("Name, phone and email are required for emergency notifications");
      return;
    }
    if (!isPhoneValid) {
      toast.error("Invalid phone number", { description: "Enter at least 10 digits." });
      return;
    }
    if (guardians.length >= guardianLimit) {
      setShowUpgrade(true);
      return;
    }
    // Check 3-ward limit by phone
    const cleanPhone = phone.trim().replace(/[\s\-\+]/g, "");
    const { data: phoneCount } = await supabase.rpc("guardian_ward_count_by_phone" as any, { _phone: cleanPhone });
    if (typeof phoneCount === "number" && phoneCount >= 3) {
      toast.error("Guardian limit reached", { description: `${name.trim()} already monitors 3 users (maximum).` });
      setAdding(false);
      return;
    }
    if (email.trim()) {
      const { data: emailCount } = await supabase.rpc("guardian_ward_count", { _guardian_email: email.trim() });
      if (typeof emailCount === "number" && emailCount >= 3) {
        toast.error("Guardian limit reached", { description: `${name.trim()} already monitors 3 users (maximum).` });
        setAdding(false);
        return;
      }
    }
    setAdding(true);
    const { error } = await supabase.from("guardians").insert({
      user_id: userId,
      guardian_name: name.trim(),
      guardian_phone: phone.trim(),
      guardian_email: email.trim() || null,
      relation: relation.trim() || null,
      is_primary: guardians.length === 0,
    });

    if (error) {
      toast.error("Failed to add guardian");
      console.error(error);
    } else {
      toast.success("Guardian added");
      setName("");
      setPhone("");
      setEmail("");
      setRelation("");
      setShowForm(false);
      fetchGuardians();
    }
    setAdding(false);
  };

  const handleSetPrimary = async () => {
    if (!primaryCandidate || !userId) return;
    setSettingPrimary(true);
    const { error: clearError } = await supabase
      .from("guardians")
      .update({ is_primary: false })
      .eq("user_id", userId)
      .eq("is_primary", true);
    if (clearError) {
      toast.error("Failed to update primary guardian");
      setSettingPrimary(false);
      return;
    }
    const { error: setError } = await supabase
      .from("guardians")
      .update({ is_primary: true })
      .eq("id", primaryCandidate.id);
    if (setError) {
      toast.error("Failed to update primary guardian");
    } else {
      toast.success("Primary guardian updated");
      fetchGuardians();
    }
    setSettingPrimary(false);
    setPrimaryCandidate(null);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("guardians").delete().eq("id", id);
    if (error) {
      toast.error("Failed to remove guardian");
    } else {
      toast.success("Guardian removed");
      fetchGuardians();
    }
  };

  return (
    <TabsContent value="guardian" className="space-y-4 mt-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">My Guardians</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : guardians.length > 0 ? (
            guardians.map((g) => (
              <div key={g.id} className="p-3 rounded-lg bg-muted/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{g.guardian_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.relation && `${g.relation} • `}{g.guardian_phone}
                    </p>
                    {g.guardian_email && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3" />
                        {g.guardian_email}
                      </p>
                    )}
                    {/* Status badge */}
                    <div className="mt-1">
                      {g.status === "rejected" && (
                        <Badge variant="destructive" className="text-xs">Rejected</Badge>
                      )}
                      {g.status === "expired" && (
                        <Badge variant="outline" className="text-xs border-warning text-warning">Expired</Badge>
                      )}
                      {g.status === "pending" && (
                        <Badge className="bg-warning text-warning-foreground text-xs">
                          Pending {(() => {
                            const expiresAt = new Date(new Date(g.nominated_at).getTime() + 72 * 60 * 60 * 1000);
                            const hoursLeft = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60)));
                            return `(${hoursLeft}h left)`;
                          })()}
                        </Badge>
                      )}
                      {g.status === "accepted" && (
                        <Badge className="bg-success text-success-foreground text-xs">Accepted</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {g.is_primary ? (
                      <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full">Primary</span>
                    ) : g.status === "accepted" ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setPrimaryCandidate(g)}
                        title="Set as Primary"
                        aria-label="Set as Primary"
                      >
                        <Star className="w-4 h-4" />
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDelete(g.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {(g.status === "pending" || g.status === "expired") && g.guardian_email && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1 w-full"
                    disabled={resending === g.id}
                    onClick={() => handleResendInvite(g)}
                  >
                    {resending === g.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Re-send Invite
                  </Button>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">
              No guardians added yet
            </p>
          )}

          {showForm ? (
            <div className="space-y-3 p-3 rounded-lg border border-border">
              <div>
                <Label className="text-xs">Name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Guardian name" className="text-base" />
              </div>
              <div>
                <Label className="text-xs">Phone *</Label>
                <PhoneInput value={phone} onChange={setPhone} />
                {phone.trim().length > 0 && !isPhoneValid && (
                  <p className="text-sm text-destructive mt-1">Enter at least 10 digits</p>
                )}
              </div>
              <div>
                <Label className="text-xs">Email * (for emergency notifications)</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="guardian@email.com" type="email" className="text-base" />
              </div>
              <div>
                <Label className="text-xs">Relation</Label>
                <Input value={relation} onChange={(e) => setRelation(e.target.value)} placeholder="e.g. Daughter, Son" className="text-base" />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAdd} disabled={adding} className="flex-1">
                  {adding && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                  Add
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                if (guardians.length >= guardianLimit) {
                  setShowUpgrade(true);
                } else {
                  setShowForm(true);
                }
              }}
            >
              {guardians.length >= guardianLimit ? (
                <><Lock className="w-4 h-4 mr-1" /> Add Guardian ({guardians.length}/{guardianLimit})</>
              ) : (
                `+ Add Guardian (${guardians.length}/${guardianLimit})`
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      <UpgradeDialog
        open={showUpgrade}
        onOpenChange={setShowUpgrade}
        featureName="Guardian Limit"
        requiredPlan={plan === "free" ? "basic" : "premium"}
        description={`Your current plan allows ${guardianLimit} guardian(s). Upgrade to add more.`}
      />

      <AlertDialog open={!!primaryCandidate} onOpenChange={(o) => !o && setPrimaryCandidate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Make {primaryCandidate?.guardian_name} your Primary Guardian?</AlertDialogTitle>
            <AlertDialogDescription>
              They will be the first contact for SOS alerts and emergency profile sharing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={settingPrimary}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleSetPrimary(); }} disabled={settingPrimary}>
              {settingPrimary && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Set as Primary
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TabsContent>
  );
};

export default GuardianTab;

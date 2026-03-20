import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { hashPin } from "@/lib/encryption";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface VaultGateProps {
  children: React.ReactNode;
  title?: string;
}

const VaultGate = ({ children, title = "Protected Content" }: VaultGateProps) => {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [loading, setLoading] = useState(true);
  const [hasPin, setHasPin] = useState(false);
  const [pinHash, setPinHash] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [isSetup, setIsSetup] = useState(false);

  const checkPin = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("vault_pins")
      .select("pin_hash")
      .eq("user_id", userId)
      .maybeSingle();
    if (data) {
      setHasPin(true);
      setPinHash(data.pin_hash);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    checkPin();
  }, [checkPin]);

  const handleSetPin = async () => {
    if (pinInput.length !== 6 || !/^\d{6}$/.test(pinInput)) {
      toast.error("PIN must be exactly 6 digits");
      return;
    }
    if (pinInput !== pinConfirm) {
      toast.error("PINs do not match");
      return;
    }
    const hash = await hashPin(pinInput);
    const { error } = await supabase.from("vault_pins").upsert(
      { user_id: userId!, pin_hash: hash } as any,
      { onConflict: "user_id" }
    );
    if (error) {
      toast.error("Failed to set PIN");
      return;
    }
    setPinHash(hash);
    setHasPin(true);
    setUnlocked(true);
    setPinInput("");
    setPinConfirm("");
    toast.success("Vault PIN set — content unlocked");
  };

  const handleVerify = async () => {
    const hash = await hashPin(pinInput);
    if (hash !== pinHash) {
      toast.error("Incorrect PIN");
      setPinInput("");
      return;
    }
    setUnlocked(true);
    setPinInput("");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (unlocked) return <>{children}</>;

  return (
    <div className="flex items-center justify-center py-12 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pb-3">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <CardTitle className="text-lg">{hasPin ? `Unlock ${title}` : `Secure ${title}`}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {hasPin
              ? "Enter your 6-digit vault PIN to access this data."
              : "Create a 6-digit vault PIN to protect your sensitive data with AES-256-GCM encryption."}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasPin ? (
            <>
              <div>
                <Label>Create 6-digit PIN</Label>
                <Input
                  type="password"
                  maxLength={6}
                  inputMode="numeric"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="● ● ● ● ● ●"
                />
              </div>
              <div>
                <Label>Confirm PIN</Label>
                <Input
                  type="password"
                  maxLength={6}
                  inputMode="numeric"
                  value={pinConfirm}
                  onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="● ● ● ● ● ●"
                />
              </div>
              <Button onClick={handleSetPin} disabled={pinInput.length !== 6} className="w-full">
                <ShieldCheck className="w-4 h-4 mr-2" /> Set PIN & Unlock
              </Button>
            </>
          ) : (
            <>
              <div>
                <Label>6-digit PIN</Label>
                <Input
                  type="password"
                  maxLength={6}
                  inputMode="numeric"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="● ● ● ● ● ●"
                  onKeyDown={(e) => e.key === "Enter" && pinInput.length === 6 && handleVerify()}
                />
              </div>
              <Button onClick={handleVerify} disabled={pinInput.length !== 6} className="w-full">
                <Lock className="w-4 h-4 mr-2" /> Unlock
              </Button>
            </>
          )}
          <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Military-grade AES-256-GCM encryption
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default VaultGate;

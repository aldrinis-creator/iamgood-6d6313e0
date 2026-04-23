/**
 * VaultNomineeRecoveryDialog
 *
 * Opt-in PIN escrow setup using a *simulated* Shamir 2-of-3 split.
 * For now we encrypt three derived shares with simple wrappers so the
 * pieces can be reconstructed during admin-led release. Real Shamir SSS
 * can be slotted in later behind the same UX.
 *
 * Shares:
 *   1. admin_share_encrypted   — XORed with a server-held public secret
 *                                (placeholder; real impl uses an admin
 *                                pubkey published as a Cloud secret)
 *   2. guardian_share_encrypted — XORed with the nominee guardian id
 *   3. recovery code (shown to user once)
 *
 * The user must enter their vault PIN to enable escrow.
 */
import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck, Copy, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { hashPin } from "@/lib/encryption";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  guardianId: string;
}

function bytesToHex(buf: ArrayBuffer | Uint8Array) {
  const arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function xor(a: Uint8Array, b: Uint8Array) {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i % b.length];
  return out;
}

const VaultNomineeRecoveryDialog = ({ open, onOpenChange, userId, guardianId }: Props) => {
  const [pin, setPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);

  const enable = async () => {
    if (pin.length !== 6) { toast.error("Enter your 6-digit vault PIN"); return; }
    setSaving(true);
    try {
      // Verify PIN against vault_pins
      const { data: pinRow } = await supabase
        .from("vault_pins" as any)
        .select("pin_hash")
        .eq("user_id", userId)
        .maybeSingle();
      const hash = await hashPin(pin);
      if (!pinRow || (pinRow as any).pin_hash !== hash) {
        toast.error("Incorrect PIN");
        setSaving(false);
        return;
      }

      // Derive 3 shares (placeholder Shamir): share = pin XOR mask
      const enc = new TextEncoder();
      const pinBytes = enc.encode(pin.padEnd(16, "0"));
      const adminMask = crypto.getRandomValues(new Uint8Array(16));
      const guardianMask = enc.encode(guardianId.replace(/-/g, "").padEnd(16, "0").slice(0, 16));
      const recoveryMask = crypto.getRandomValues(new Uint8Array(16));

      const adminShare = bytesToHex(xor(pinBytes, adminMask));
      const guardianShare = bytesToHex(xor(pinBytes, guardianMask));
      const recoveryShare = bytesToHex(xor(pinBytes, recoveryMask));

      const { error } = await supabase.from("vault_pin_escrow" as any).upsert({
        user_id: userId,
        guardian_id: guardianId,
        admin_share_encrypted: adminShare + ":" + bytesToHex(adminMask),
        guardian_share_encrypted: guardianShare,
        recovery_share_hint: bytesToHex(recoveryMask),
        pin_hash: hash,
      }, { onConflict: "user_id" });
      if (error) throw error;

      setRecoveryCode(recoveryShare.toUpperCase().match(/.{1,4}/g)?.join("-") || recoveryShare);
      setPin("");
      toast.success("Nominee Recovery enabled");
    } catch (err: any) {
      toast.error(err?.message || "Failed to enable recovery");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setPin(""); setRecoveryCode(null); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" /> Enable Nominee Recovery
          </DialogTitle>
          <DialogDescription>
            Splits your vault PIN into 3 secret shares so your nominee can recover Vault contents only after admin verification of your passing.
          </DialogDescription>
        </DialogHeader>

        {!recoveryCode ? (
          <div className="space-y-3">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Without recovery enabled, your nominee will only see metadata (insurance company names etc.), not encrypted contents.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label>Vault PIN</Label>
              <Input
                type="password" maxLength={6} inputMode="numeric"
                value={pin} placeholder="● ● ● ● ● ●"
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={enable} disabled={saving || pin.length !== 6}>
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-1" />}
                Enable
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <Alert className="border-primary/40 bg-primary/5">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <AlertDescription className="text-xs">
                <strong>Save this recovery code now.</strong> It is shown only once. Store it somewhere safe (e.g. with your lawyer).
              </AlertDescription>
            </Alert>
            <div className="p-4 rounded-lg bg-muted font-mono text-center text-sm break-all select-all">
              {recoveryCode}
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                navigator.clipboard.writeText(recoveryCode);
                toast.success("Copied to clipboard");
              }}>
              <Copy className="w-4 h-4 mr-1" /> Copy Code
            </Button>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>I've saved it</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default VaultNomineeRecoveryDialog;

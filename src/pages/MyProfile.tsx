import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { User, Phone, Calendar, Scale, Ruler, Heart, Shield, Eye, EyeOff, Lock, Save, Edit, ShieldCheck } from "lucide-react";
import { encrypt, decrypt, hashPin } from "@/lib/encryption";
import { differenceInYears, parse } from "date-fns";

interface EncryptedDoc {
  id: string;
  doc_type: string;
  encrypted_value: string;
  iv: string;
  salt: string;
}

const BMI_CATEGORIES = [
  { max: 18.5, label: "Underweight", color: "text-blue-500" },
  { max: 25, label: "Normal", color: "text-success" },
  { max: 30, label: "Overweight", color: "text-yellow-500" },
  { max: Infinity, label: "Obese", color: "text-destructive" },
];

const getBmiInfo = (bmi: number) =>
  BMI_CATEGORIES.find((c) => bmi < c.max) ?? BMI_CATEGORIES[3];

const MyProfile = () => {
  const { session, profile, refreshProfile } = useAuth();
  const userId = session?.user?.id;

  // Edit mode
  const [editing, setEditing] = useState(false);

  // Profile fields
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [heightM, setHeightM] = useState("");

  // Guardian
  const [guardian, setGuardian] = useState<any>(null);

  // Health profile
  const [healthProfile, setHealthProfile] = useState<any>(null);

  // Encrypted docs
  const [encDocs, setEncDocs] = useState<EncryptedDoc[]>([]);
  const [hasPin, setHasPin] = useState(false);
  const [pinHash, setPinHash] = useState("");

  // Vault dialogs
  const [showSetPin, setShowSetPin] = useState(false);
  const [showEnterPin, setShowEnterPin] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pendingAction, setPendingAction] = useState<"view" | "add" | null>(null);
  const [pendingDocType, setPendingDocType] = useState<string>("");

  // Decrypted values (transient)
  const [decryptedValues, setDecryptedValues] = useState<Record<string, string>>({});
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});

  // Add doc dialog
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [newDocValue, setNewDocValue] = useState("");
  const [addDocType, setAddDocType] = useState("aadhaar");
  const [currentPin, setCurrentPin] = useState("");

  const [saving, setSaving] = useState(false);

  // Load data
  const loadData = useCallback(async () => {
    if (!userId) return;

    const [guardianRes, healthRes, docsRes, pinRes] = await Promise.all([
      supabase.from("guardians").select("*").eq("user_id", userId).eq("is_primary", true).limit(1),
      supabase.from("health_profile").select("*").eq("user_id", userId).limit(1),
      supabase.from("encrypted_documents").select("*").eq("user_id", userId),
      supabase.from("vault_pins").select("*").eq("user_id", userId).limit(1),
    ]);

    if (guardianRes.data?.[0]) setGuardian(guardianRes.data[0]);
    if (healthRes.data?.[0]) setHealthProfile(healthRes.data[0]);
    if (docsRes.data) setEncDocs(docsRes.data as EncryptedDoc[]);
    if (pinRes.data?.[0]) {
      setHasPin(true);
      setPinHash(pinRes.data[0].pin_hash);
    }
  }, [userId]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setDob(profile.date_of_birth || "");
      setPhone(profile.phone || "");
      setGender((profile as any).gender || "");
      setWeightKg((profile as any).weight_kg?.toString() || "");
      setHeightM((profile as any).height_m?.toString() || "");
    }
    loadData();
  }, [profile, loadData]);

  const age = dob
    ? differenceInYears(new Date(), parse(dob, "yyyy-MM-dd", new Date()))
    : null;

  const weight = parseFloat(weightKg);
  const height = parseFloat(heightM);
  const bmi = weight > 0 && height > 0 ? weight / (height * height) : null;
  const bmiInfo = bmi ? getBmiInfo(bmi) : null;

  // Save profile
  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        date_of_birth: dob || null,
        phone: phone || null,
        gender: gender || null,
        weight_kg: weightKg ? parseFloat(weightKg) : null,
        height_m: heightM ? parseFloat(heightM) : null,
      } as any)
      .eq("id", userId);
    setSaving(false);
    if (error) {
      toast.error("Failed to save profile");
    } else {
      toast.success("Profile updated");
      setEditing(false);
      await refreshProfile();
    }
  };

  // PIN flow
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
    setCurrentPin(pinInput);
    setShowSetPin(false);
    setPinInput("");
    setPinConfirm("");
    toast.success("Vault PIN set successfully");

    if (pendingAction === "add") {
      setShowAddDoc(true);
    }
  };

  const handleVerifyPin = async () => {
    const hash = await hashPin(pinInput);
    if (hash !== pinHash) {
      toast.error("Incorrect PIN");
      return;
    }
    setCurrentPin(pinInput);
    setShowEnterPin(false);
    setPinInput("");

    if (pendingAction === "view") {
      await decryptDoc(pendingDocType, pinInput);
    } else if (pendingAction === "add") {
      setShowAddDoc(true);
    }
    setPendingAction(null);
    setPendingDocType("");
  };

  const requestPin = (action: "view" | "add", docType: string = "") => {
    setPendingAction(action);
    setPendingDocType(docType);
    if (!hasPin) {
      setShowSetPin(true);
    } else if (!currentPin) {
      setShowEnterPin(true);
    } else if (action === "view") {
      decryptDoc(docType, currentPin);
    } else {
      setShowAddDoc(true);
    }
  };

  const decryptDoc = async (docType: string, pin: string) => {
    const doc = encDocs.find((d) => d.doc_type === docType);
    if (!doc) return;
    try {
      const value = await decrypt(doc.encrypted_value, doc.iv, doc.salt, pin);
      setDecryptedValues((prev) => ({ ...prev, [docType]: value }));
      setShowValues((prev) => ({ ...prev, [docType]: true }));
      // Auto-hide after 30 seconds
      setTimeout(() => {
        setShowValues((prev) => ({ ...prev, [docType]: false }));
        setDecryptedValues((prev) => {
          const copy = { ...prev };
          delete copy[docType];
          return copy;
        });
      }, 30000);
    } catch {
      toast.error("Decryption failed — wrong PIN?");
      setCurrentPin("");
    }
  };

  const handleAddDoc = async () => {
    if (!newDocValue.trim() || !currentPin) return;
    const encrypted = await encrypt(newDocValue.trim(), currentPin);
    const { error } = await supabase.from("encrypted_documents").upsert(
      {
        user_id: userId!,
        doc_type: addDocType,
        encrypted_value: encrypted.ciphertext,
        iv: encrypted.iv,
        salt: encrypted.salt,
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: "user_id,doc_type" }
    );
    if (error) {
      toast.error("Failed to save document");
    } else {
      toast.success(`${addDocType.toUpperCase()} saved with encryption`);
      setShowAddDoc(false);
      setNewDocValue("");
      loadData();
    }
  };

  const toggleShowDoc = (docType: string) => {
    if (showValues[docType]) {
      setShowValues((prev) => ({ ...prev, [docType]: false }));
    } else {
      requestPin("view", docType);
    }
  };

  const hasDoc = (type: string) => encDocs.some((d) => d.doc_type === type);

  return (
    <AppLayout>
      <div className="p-4 pb-28 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">My Profile</h1>
            <p className="text-sm text-muted-foreground">Manage your health information</p>
          </div>
          <Button
            variant={editing ? "default" : "outline"}
            size="sm"
            onClick={() => (editing ? handleSave() : setEditing(true))}
            disabled={saving}
          >
            {editing ? (
              <><Save className="w-4 h-4 mr-1" /> {saving ? "Saving..." : "Save"}</>
            ) : (
              <><Edit className="w-4 h-4 mr-1" /> Edit</>
            )}
          </Button>
        </div>

        {/* Personal Information */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4 text-primary" /> Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {editing ? (
              <>
                <div>
                  <Label>Full Name</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div>
                  <Label>Date of Birth</Label>
                  <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
                </div>
                <div>
                  <Label>Mobile Number</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 ..." />
                </div>
                <div>
                  <Label>Gender</Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Full Name</span><span className="font-medium">{fullName || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Date of Birth</span><span className="font-medium">{dob ? `${dob} (${age} yrs)` : "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Mobile</span><span className="font-medium">{phone || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Gender</span><span className="font-medium capitalize">{gender || "—"}</span></div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Body Metrics */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="w-4 h-4 text-primary" /> Body Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editing ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Weight (kg)</Label>
                  <Input type="number" step="0.1" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
                </div>
                <div>
                  <Label>Height (m)</Label>
                  <Input type="number" step="0.01" value={heightM} onChange={(e) => setHeightM(e.target.value)} />
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><Scale className="w-3 h-3" /> Weight</span><span className="font-medium">{weightKg ? `${weightKg} kg` : "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><Ruler className="w-3 h-3" /> Height</span><span className="font-medium">{heightM ? `${heightM} m` : "—"}</span></div>
                {bmi && bmiInfo && (
                  <div className="flex justify-between items-center pt-1 border-t">
                    <span className="text-muted-foreground font-medium">BMI</span>
                    <span className={`font-bold ${bmiInfo.color}`}>
                      {bmi.toFixed(1)} — {bmiInfo.label}
                    </span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Primary Guardian */}
        {guardian && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" /> Primary Guardian
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{guardian.guardian_name}</p>
                  <p className="text-xs text-muted-foreground">{guardian.guardian_phone}</p>
                  {guardian.relation && <p className="text-xs text-muted-foreground capitalize">{guardian.relation}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-success border-success text-xs">
                    {guardian.status}
                  </Badge>
                  <Button size="icon" variant="ghost" asChild>
                    <a href={`tel:${guardian.guardian_phone}`}><Phone className="w-4 h-4 text-primary" /></a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Government ID Cards — Encrypted */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" /> Government ID Cards
              <Badge variant="secondary" className="text-xs ml-auto">AES-256-GCM</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {["aadhaar", "pan"].map((type) => (
              <div key={type} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium capitalize">{type === "aadhaar" ? "Aadhaar Card" : "PAN Card"}</p>
                  {hasDoc(type) ? (
                    <p className="text-xs font-mono mt-0.5">
                      {showValues[type] && decryptedValues[type]
                        ? decryptedValues[type]
                        : "●●●● ●●●● ●●●●"}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Not added</p>
                  )}
                </div>
                <div className="flex gap-1">
                  {hasDoc(type) ? (
                    <Button size="icon" variant="ghost" onClick={() => toggleShowDoc(type)}>
                      {showValues[type] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => { setAddDocType(type); requestPin("add"); }}>
                      Add
                    </Button>
                  )}
                </div>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Shield className="w-3 h-3" /> End-to-end encrypted with your vault PIN. We never see your data.
            </p>
          </CardContent>
        </Card>

        {/* Health Information */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Heart className="w-4 h-4 text-destructive" /> Health Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Blood Group</span>
              <span className="font-medium">{healthProfile?.blood_group || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Allergies</span>
              <span className="font-medium text-right max-w-[60%]">
                {healthProfile?.allergies?.length ? healthProfile.allergies.join(", ") : "None"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Chronic Conditions</span>
              <span className="font-medium text-right max-w-[60%]">
                {healthProfile?.chronic_conditions?.length ? healthProfile.chronic_conditions.join(", ") : "None"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Medications</span>
              <span className="font-medium text-right max-w-[60%]">
                {healthProfile?.current_medications?.length ? healthProfile.current_medications.join(", ") : "None"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Set PIN Dialog */}
      <Dialog open={showSetPin} onOpenChange={setShowSetPin}>
        <DialogContent>
          <DialogHeader><DialogTitle>Set Vault PIN</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Create a 6-digit PIN to encrypt your sensitive documents.</p>
          <div className="space-y-3">
            <div>
              <Label>Enter 6-digit PIN</Label>
              <Input type="password" maxLength={6} inputMode="numeric" pattern="\d{6}" value={pinInput} onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))} />
            </div>
            <div>
              <Label>Confirm PIN</Label>
              <Input type="password" maxLength={6} inputMode="numeric" pattern="\d{6}" value={pinConfirm} onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSetPin} disabled={pinInput.length !== 6}>Set PIN</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enter PIN Dialog */}
      <Dialog open={showEnterPin} onOpenChange={setShowEnterPin}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enter Vault PIN</DialogTitle></DialogHeader>
          <div>
            <Label>6-digit PIN</Label>
            <Input type="password" maxLength={6} inputMode="numeric" value={pinInput} onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))} />
          </div>
          <DialogFooter>
            <Button onClick={handleVerifyPin} disabled={pinInput.length !== 6}>Unlock</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Document Dialog */}
      <Dialog open={showAddDoc} onOpenChange={setShowAddDoc}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add {addDocType === "aadhaar" ? "Aadhaar" : "PAN"} Number</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will be encrypted with AES-256-GCM before storage.</p>
          <div>
            <Label>{addDocType === "aadhaar" ? "Aadhaar Number" : "PAN Number"}</Label>
            <Input
              value={newDocValue}
              onChange={(e) => setNewDocValue(e.target.value)}
              placeholder={addDocType === "aadhaar" ? "1234 5678 9012" : "ABCDE1234F"}
              maxLength={addDocType === "aadhaar" ? 14 : 10}
            />
          </div>
          <DialogFooter>
            <Button onClick={handleAddDoc} disabled={!newDocValue.trim()}>
              <Lock className="w-4 h-4 mr-1" /> Encrypt & Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default MyProfile;

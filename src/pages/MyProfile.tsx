import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import VaultGate from "@/components/VaultGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  User, Phone, Calendar, Scale, Ruler, Heart, Shield, Eye, EyeOff, Lock,
  Save, Edit, ShieldCheck, Stethoscope, Camera, Upload, X, FileText, Image,
  Trash2, Mail, Plus, Loader2,
} from "lucide-react";
import { encrypt, decrypt, hashPin } from "@/lib/encryption";
import { differenceInYears, parse } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

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

const getBmiInfo = (bmi: number) => BMI_CATEGORIES.find((c) => bmi < c.max) ?? BMI_CATEGORIES[3];

const MyProfile = () => {
  return (
    <AppLayout>
      <div className="p-4 pb-28">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-foreground">My Profile</h1>
          <p className="text-sm text-muted-foreground">Protected with military-grade encryption</p>
        </div>
        <VaultGate title="My Profile">
          <ProfileContent />
        </VaultGate>
      </div>
    </AppLayout>
  );
};

const ProfileContent = () => {
  const { session, profile, refreshProfile } = useAuth();
  const userId = session?.user?.id;

  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [heightM, setHeightM] = useState("");

  // Family Doctor
  const [doctorName, setDoctorName] = useState("");
  const [doctorPhone, setDoctorPhone] = useState("");

  // Guardians
  const [guardians, setGuardians] = useState<any[]>([]);
  const [showGuardianForm, setShowGuardianForm] = useState(false);
  const [gName, setGName] = useState("");
  const [gPhone, setGPhone] = useState("");
  const [gEmail, setGEmail] = useState("");
  const [gRelation, setGRelation] = useState("");
  const [addingGuardian, setAddingGuardian] = useState(false);

  // Encrypted docs
  const [encDocs, setEncDocs] = useState<EncryptedDoc[]>([]);
  const [hasPin, setHasPin] = useState(false);
  const [pinHash, setPinHash] = useState("");
  const [currentPin, setCurrentPin] = useState("");

  // Vault dialogs
  const [showEnterPin, setShowEnterPin] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pendingAction, setPendingAction] = useState<"view" | "add" | null>(null);
  const [pendingDocType, setPendingDocType] = useState("");

  // Decrypted values
  const [decryptedValues, setDecryptedValues] = useState<Record<string, string>>({});
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});

  // Add doc dialog
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [newDocValue, setNewDocValue] = useState("");
  const [addDocType, setAddDocType] = useState("aadhaar");

  // Photo upload
  const [idPhotos, setIdPhotos] = useState<Record<string, string>>({});
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoUploadType, setPhotoUploadType] = useState("");

  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!userId) return;

    const [guardianRes, healthRes, docsRes, pinRes] = await Promise.all([
      supabase.from("guardians").select("*").eq("user_id", userId).order("is_primary", { ascending: false }),
      supabase.from("health_profile").select("*").eq("user_id", userId).limit(1),
      supabase.from("encrypted_documents").select("*").eq("user_id", userId),
      supabase.from("vault_pins").select("*").eq("user_id", userId).limit(1),
    ]);

    if (guardianRes.data) setGuardians(guardianRes.data);
    if (healthRes.data?.[0]) {
      setDoctorName((healthRes.data[0] as any).family_doctor_name || "");
      setDoctorPhone((healthRes.data[0] as any).family_doctor_phone || "");
    }
    if (docsRes.data) setEncDocs(docsRes.data as EncryptedDoc[]);
    if (pinRes.data?.[0]) {
      setHasPin(true);
      setPinHash(pinRes.data[0].pin_hash);
    }

    // Load photo URLs
    for (const type of ["aadhaar", "pan"]) {
      const { data } = await supabase.storage
        .from("medical-documents")
        .createSignedUrl(`${userId}/${type}_photo`, 3600);
      if (data?.signedUrl) {
        setIdPhotos((prev) => ({ ...prev, [type]: data.signedUrl }));
      }
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

  const age = dob ? differenceInYears(new Date(), parse(dob, "yyyy-MM-dd", new Date())) : null;
  const weight = parseFloat(weightKg);
  const height = parseFloat(heightM);
  const bmi = weight > 0 && height > 0 ? weight / (height * height) : null;
  const bmiInfo = bmi ? getBmiInfo(bmi) : null;

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);

    const [profileRes, healthRes] = await Promise.all([
      supabase.from("profiles").update({
        full_name: fullName,
        date_of_birth: dob || null,
        phone: phone || null,
        gender: gender || null,
        weight_kg: weightKg ? parseFloat(weightKg) : null,
        height_m: heightM ? parseFloat(heightM) : null,
      } as any).eq("id", userId),
      supabase.from("health_profile").upsert({
        user_id: userId,
        family_doctor_name: doctorName || null,
        family_doctor_phone: doctorPhone || null,
      } as any, { onConflict: "user_id" }),
    ]);

    setSaving(false);
    if (profileRes.error || healthRes.error) {
      toast.error("Failed to save profile");
    } else {
      toast.success("Profile updated");
      setEditing(false);
      await refreshProfile();
    }
  };

  // Encrypted doc PIN flow
  const requestPin = (action: "view" | "add", docType: string = "") => {
    setPendingAction(action);
    setPendingDocType(docType);
    if (!currentPin) {
      setShowEnterPin(true);
    } else if (action === "view") {
      decryptDoc(docType, currentPin);
    } else {
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

  const decryptDoc = async (docType: string, pin: string) => {
    const doc = encDocs.find((d) => d.doc_type === docType);
    if (!doc) return;
    try {
      const value = await decrypt(doc.encrypted_value, doc.iv, doc.salt, pin);
      setDecryptedValues((prev) => ({ ...prev, [docType]: value }));
      setShowValues((prev) => ({ ...prev, [docType]: true }));
      setTimeout(() => {
        setShowValues((prev) => ({ ...prev, [docType]: false }));
        setDecryptedValues((prev) => { const c = { ...prev }; delete c[docType]; return c; });
      }, 30000);
    } catch {
      toast.error("Decryption failed — wrong PIN?");
      setCurrentPin("");
    }
  };

  const handleAddDoc = async () => {
    if (!newDocValue.trim() || !currentPin) return;
    const encrypted = await encrypt(newDocValue.trim(), currentPin);
    const { error } = await supabase.from("encrypted_documents").upsert({
      user_id: userId!,
      doc_type: addDocType,
      encrypted_value: encrypted.ciphertext,
      iv: encrypted.iv,
      salt: encrypted.salt,
      updated_at: new Date().toISOString(),
    } as any, { onConflict: "user_id,doc_type" });
    if (error) {
      toast.error("Failed to save document");
    } else {
      toast.success(`${addDocType.toUpperCase()} saved securely`);
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

  // Photo upload handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId || !photoUploadType) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File must be under 5MB");
      return;
    }

    setUploadingPhoto(photoUploadType);
    const path = `${userId}/${photoUploadType}_photo`;

    // Delete existing first
    await supabase.storage.from("medical-documents").remove([path]);

    const { error } = await supabase.storage
      .from("medical-documents")
      .upload(path, file, { upsert: true });

    if (error) {
      toast.error("Failed to upload photo");
    } else {
      toast.success(`${photoUploadType === "aadhaar" ? "Aadhaar" : "PAN"} photo uploaded`);
      const { data } = await supabase.storage
        .from("medical-documents")
        .createSignedUrl(path, 3600);
      if (data?.signedUrl) {
        setIdPhotos((prev) => ({ ...prev, [photoUploadType]: data.signedUrl }));
      }
    }
    setUploadingPhoto(null);
    setPhotoUploadType("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const triggerPhotoUpload = (type: string) => {
    setPhotoUploadType(type);
    setTimeout(() => fileInputRef.current?.click(), 50);
  };

  return (
    <div className="space-y-4">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoUpload}
      />

      {/* Edit toggle */}
      <div className="flex justify-end">
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
              <div><Label>Full Name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
              <div><Label>Date of Birth</Label><Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></div>
              <div><Label>Mobile Number</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 ..." /></div>
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
              <InfoRow label="Full Name" value={fullName} />
              <InfoRow label="Date of Birth" value={dob ? `${dob} (${age} yrs)` : "—"} />
              <InfoRow label="Mobile" value={phone} />
              <InfoRow label="Gender" value={gender} capitalize />
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
              <div><Label>Weight (kg)</Label><Input type="number" step="0.1" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} /></div>
              <div><Label>Height (m)</Label><Input type="number" step="0.01" value={heightM} onChange={(e) => setHeightM(e.target.value)} /></div>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <InfoRow label="Weight" value={weightKg ? `${weightKg} kg` : "—"} />
              <InfoRow label="Height" value={heightM ? `${heightM} m` : "—"} />
              {bmi && bmiInfo && (
                <div className="flex justify-between items-center pt-1 border-t">
                  <span className="text-muted-foreground font-medium">BMI</span>
                  <span className={`font-bold ${bmiInfo.color}`}>{bmi.toFixed(1)} — {bmiInfo.label}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Family Doctor */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-success" /> Family Doctor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {editing ? (
            <>
              <div><Label>Doctor Name</Label><Input value={doctorName} onChange={(e) => setDoctorName(e.target.value)} placeholder="Dr. Sharma" /></div>
              <div><Label>Doctor Mobile</Label><Input value={doctorPhone} onChange={(e) => setDoctorPhone(e.target.value)} placeholder="+91 ..." /></div>
            </>
          ) : (
            <div className="space-y-2 text-sm">
              <InfoRow label="Doctor Name" value={doctorName} />
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Doctor Mobile</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{doctorPhone || "—"}</span>
                  {doctorPhone && (
                    <Button size="icon" variant="ghost" className="h-6 w-6" asChild>
                      <a href={`tel:${doctorPhone}`}><Phone className="w-3 h-3 text-primary" /></a>
                    </Button>
                  )}
                </div>
              </div>
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
                <Badge variant="outline" className="text-success border-success text-xs">{guardian.status}</Badge>
                <Button size="icon" variant="ghost" asChild>
                  <a href={`tel:${guardian.guardian_phone}`}><Phone className="w-4 h-4 text-primary" /></a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Government ID Cards */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" /> Government ID Cards
            <Badge variant="secondary" className="text-xs ml-auto">AES-256-GCM</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {["aadhaar", "pan"].map((type) => (
            <div key={type} className="rounded-lg bg-muted/50 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{type === "aadhaar" ? "Aadhaar Card" : "PAN Card"}</p>
                  {hasDoc(type) ? (
                    <p className="text-xs font-mono mt-0.5">
                      {showValues[type] && decryptedValues[type] ? decryptedValues[type] : "●●●● ●●●● ●●●●"}
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

              {/* Photo section */}
              <div className="flex items-center gap-3">
                {idPhotos[type] ? (
                  <div className="relative">
                    <img
                      src={idPhotos[type]}
                      alt={`${type} photo`}
                      className="w-20 h-14 object-cover rounded border"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute -top-1 -right-1 h-5 w-5 bg-background shadow rounded-full"
                      onClick={() => triggerPhotoUpload(type)}
                    >
                      <Camera className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1"
                    onClick={() => triggerPhotoUpload(type)}
                    disabled={uploadingPhoto === type}
                  >
                    {uploadingPhoto === type ? (
                      <><span className="animate-spin">⏳</span> Uploading...</>
                    ) : (
                      <><Camera className="w-3 h-3" /> Upload Photo</>
                    )}
                  </Button>
                )}
              </div>
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Shield className="w-3 h-3" /> End-to-end encrypted. Photos stored in your private vault.
          </p>
        </CardContent>
      </Card>

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
          <p className="text-sm text-muted-foreground">Encrypted with AES-256-GCM before storage.</p>
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
    </div>
  );
};

const InfoRow = ({ label, value, capitalize }: { label: string; value: string; capitalize?: boolean }) => (
  <div className="flex justify-between">
    <span className="text-muted-foreground">{label}</span>
    <span className={`font-medium ${capitalize ? "capitalize" : ""}`}>{value || "—"}</span>
  </div>
);

export default MyProfile;

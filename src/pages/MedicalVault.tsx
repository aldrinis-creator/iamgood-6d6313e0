import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Eye, EyeOff, FileText, Shield, Heart, User, Upload, Trash2, Download,
  File, Loader2, Search, Plus, Lock, ShieldCheck, Camera
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import AppLayout from "@/components/AppLayout";
import VaultGate from "@/components/VaultGate";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { encrypt, decrypt, hashPin } from "@/lib/encryption";
import GuardianTab from "@/components/GuardianTab";

const RECORD_TYPES = [
  "Prescription", "Lab Report", "Discharge Summary",
  "X-Ray / Scan", "Insurance Document", "Vaccination Record", "Other",
];

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

interface MedicalRecord {
  id: string;
  title: string;
  record_type: string;
  record_date: string | null;
  doctor_name: string | null;
  hospital_name: string | null;
  description: string | null;
  file_name: string | null;
  file_url: string | null;
  created_at: string;
}

interface HealthProfileData {
  blood_group: string;
  allergies: string[];
  chronic_conditions: string[];
  current_medications: string[];
  emergency_notes: string;
  family_doctor_name: string;
  family_doctor_phone: string;
}

interface EncryptedDoc {
  id: string;
  doc_type: string;
  encrypted_value: string;
  iv: string;
  salt: string;
}

const DOC_TYPES = [
  { key: "aadhaar", label: "Aadhaar Number", placeholder: "1234 5678 9012" },
  { key: "pan", label: "PAN Number", placeholder: "ABCDE1234F" },
  { key: "passport", label: "Passport Number", placeholder: "A1234567" },
  { key: "driving_license", label: "Driving License", placeholder: "DL-1234567890" },
  { key: "health_insurance_id", label: "Health Insurance ID", placeholder: "Policy number" },
  { key: "life_insurance_id", label: "Life Insurance ID", placeholder: "Policy number" },
];

const MedicalVaultContent = () => {
  const { session } = useAuth();
  const userId = session?.user?.id;

  // --- Records Tab ---
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [recordType, setRecordType] = useState("");
  const [recordDate, setRecordDate] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);

  // --- Profile Tab ---
  const [healthProfile, setHealthProfile] = useState<HealthProfileData>({
    blood_group: "", allergies: [], chronic_conditions: [],
    current_medications: [], emergency_notes: "",
    family_doctor_name: "", family_doctor_phone: "",
  });
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [allergyInput, setAllergyInput] = useState("");
  const [conditionInput, setConditionInput] = useState("");
  const [medicationInput, setMedicationInput] = useState("");

  // --- Secret Vault Tab ---
  const [encDocs, setEncDocs] = useState<EncryptedDoc[]>([]);
  const [decryptedValues, setDecryptedValues] = useState<Record<string, string>>({});
  const [pinForVault, setPinForVault] = useState("");
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  const [storedPinHash, setStoredPinHash] = useState("");
  const [addDocDialog, setAddDocDialog] = useState(false);
  const [addDocType, setAddDocType] = useState("");
  const [addDocValue, setAddDocValue] = useState("");
  const [addingDoc, setAddingDoc] = useState(false);

  // ===================== RECORDS =====================

  const fetchRecords = useCallback(async () => {
    if (!userId) return;
    setLoadingRecords(true);
    const { data } = await supabase
      .from("medical_records")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setRecords(data ?? []);
    setLoadingRecords(false);
  }, [userId]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const resetForm = () => {
    setTitle(""); setRecordType(""); setRecordDate("");
    setDoctorName(""); setHospitalName(""); setDescription("");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!userId) return;
    if (!title || !recordType) { toast.error("Title and type are required"); return; }
    setUploading(true);
    try {
      let fileUrl: string | null = null;
      let fileName: string | null = null;
      if (selectedFile) {
        const ext = selectedFile.name.split(".").pop();
        const path = `${userId}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("medical-documents").upload(path, selectedFile);
        if (uploadErr) throw uploadErr;
        fileUrl = path;
        fileName = selectedFile.name;
      }
      const { error } = await supabase.from("medical_records").insert({
        user_id: userId, title, record_type: recordType,
        record_date: recordDate || null, doctor_name: doctorName || null,
        hospital_name: hospitalName || null, description: description || null,
        file_url: fileUrl, file_name: fileName,
      });
      if (error) throw error;
      toast.success("Record saved");
      resetForm();
      setShowUploadForm(false);
      fetchRecords();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (r: MedicalRecord) => {
    if (r.file_url) {
      await supabase.storage.from("medical-documents").remove([r.file_url]);
    }
    await supabase.from("medical_records").delete().eq("id", r.id);
    toast.success("Deleted");
    fetchRecords();
  };

  const handleDownload = async (r: MedicalRecord) => {
    if (!r.file_url) return;
    const { data } = await supabase.storage.from("medical-documents").download(r.file_url);
    if (!data) { toast.error("Download failed"); return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(data);
    a.download = r.file_name || "document";
    a.click();
  };

  const filteredRecords = records.filter((r) => {
    const matchSearch = !searchQuery || r.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchType = !filterType || r.record_type === filterType;
    return matchSearch && matchType;
  });

  // ===================== HEALTH PROFILE =====================

  const fetchHealthProfile = useCallback(async () => {
    if (!userId) return;
    setProfileLoading(true);
    const { data } = await supabase
      .from("health_profile")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (data) {
      setHealthProfile({
        blood_group: data.blood_group || "",
        allergies: data.allergies || [],
        chronic_conditions: data.chronic_conditions || [],
        current_medications: data.current_medications || [],
        emergency_notes: data.emergency_notes || "",
        family_doctor_name: data.family_doctor_name || "",
        family_doctor_phone: data.family_doctor_phone || "",
      });
    }
    setProfileLoading(false);
  }, [userId]);

  useEffect(() => { fetchHealthProfile(); }, [fetchHealthProfile]);

  const saveHealthProfile = async () => {
    if (!userId) return;
    setProfileSaving(true);
    const { error } = await supabase.from("health_profile").upsert({
      user_id: userId,
      blood_group: healthProfile.blood_group || null,
      allergies: healthProfile.allergies,
      chronic_conditions: healthProfile.chronic_conditions,
      current_medications: healthProfile.current_medications,
      emergency_notes: healthProfile.emergency_notes || null,
      family_doctor_name: healthProfile.family_doctor_name || null,
      family_doctor_phone: healthProfile.family_doctor_phone || null,
    }, { onConflict: "user_id" });
    if (error) {
      toast.error("Failed to save profile");
    } else {
      toast.success("Health profile saved");
    }
    setProfileSaving(false);
  };

  const addChip = (field: "allergies" | "chronic_conditions" | "current_medications", value: string) => {
    if (!value.trim()) return;
    setHealthProfile((p) => ({
      ...p,
      [field]: [...p[field], value.trim()],
    }));
  };

  const removeChip = (field: "allergies" | "chronic_conditions" | "current_medications", idx: number) => {
    setHealthProfile((p) => ({
      ...p,
      [field]: p[field].filter((_, i) => i !== idx),
    }));
  };

  // ===================== SECRET VAULT =====================

  const fetchEncryptedDocs = useCallback(async () => {
    if (!userId) return;
    const [{ data: docs }, { data: pinData }] = await Promise.all([
      supabase.from("encrypted_documents").select("*").eq("user_id", userId),
      supabase.from("vault_pins").select("pin_hash").eq("user_id", userId).maybeSingle(),
    ]);
    setEncDocs(docs || []);
    if (pinData) setStoredPinHash(pinData.pin_hash);
  }, [userId]);

  useEffect(() => { fetchEncryptedDocs(); }, [fetchEncryptedDocs]);

  const unlockVault = async () => {
    if (!pinForVault || pinForVault.length !== 6) { toast.error("Enter 6-digit PIN"); return; }
    const hash = await hashPin(pinForVault);
    if (hash !== storedPinHash) { toast.error("Incorrect PIN"); setPinForVault(""); return; }
    // Decrypt all docs
    const decrypted: Record<string, string> = {};
    for (const doc of encDocs) {
      try {
        decrypted[doc.doc_type] = await decrypt(doc.encrypted_value, doc.iv, doc.salt, pinForVault);
      } catch {
        decrypted[doc.doc_type] = "⚠ Decryption failed";
      }
    }
    setDecryptedValues(decrypted);
    setVaultUnlocked(true);
    setPinForVault("");
  };

  const handleAddDoc = async () => {
    if (!userId || !addDocType || !addDocValue.trim()) { toast.error("Fill all fields"); return; }
    setAddingDoc(true);
    try {
      // Use the vault PIN (stored in storedPinHash means user must have a PIN)
      // We need the raw PIN to encrypt — prompt for it
      const pin = prompt("Enter your 6-digit vault PIN to encrypt:");
      if (!pin || pin.length !== 6) { toast.error("Valid PIN required"); setAddingDoc(false); return; }
      const hash = await hashPin(pin);
      if (hash !== storedPinHash) { toast.error("Incorrect PIN"); setAddingDoc(false); return; }

      const { ciphertext, iv, salt } = await encrypt(addDocValue.trim(), pin);

      // Check if doc type already exists
      const existing = encDocs.find((d) => d.doc_type === addDocType);
      if (existing) {
        await supabase.from("encrypted_documents").update({
          encrypted_value: ciphertext, iv, salt,
        }).eq("id", existing.id);
      } else {
        await supabase.from("encrypted_documents").insert({
          user_id: userId, doc_type: addDocType,
          encrypted_value: ciphertext, iv, salt,
        });
      }

      toast.success("Document encrypted & saved");
      setAddDocDialog(false);
      setAddDocType("");
      setAddDocValue("");
      setVaultUnlocked(false);
      setDecryptedValues({});
      fetchEncryptedDocs();
    } catch {
      toast.error("Encryption failed");
    } finally {
      setAddingDoc(false);
    }
  };

  const handleDeleteDoc = async (id: string) => {
    await supabase.from("encrypted_documents").delete().eq("id", id);
    toast.success("Document deleted");
    setDecryptedValues({});
    setVaultUnlocked(false);
    fetchEncryptedDocs();
  };

  // ===================== RENDER =====================

  const ChipInput = ({ label, items, onAdd, onRemove, inputValue, setInputValue, placeholder }: {
    label: string; items: string[]; onAdd: () => void; onRemove: (i: number) => void;
    inputValue: string; setInputValue: (v: string) => void; placeholder: string;
  }) => (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-1 flex-wrap mb-2">
        {items.map((item, i) => (
          <Badge key={i} variant="secondary" className="text-xs cursor-pointer" onClick={() => onRemove(i)}>
            {item} ✕
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder={placeholder} value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAdd(); setInputValue(""); } }}
          className="text-base"
        />
        <Button variant="outline" size="sm" onClick={() => { onAdd(); setInputValue(""); }}>
          <Plus className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      <Tabs defaultValue="records">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="records" className="text-xs gap-1">
            <FileText className="w-3 h-3" /> Records
          </TabsTrigger>
          <TabsTrigger value="profile" className="text-xs gap-1">
            <Heart className="w-3 h-3" /> Profile
          </TabsTrigger>
          <TabsTrigger value="guardian" className="text-xs gap-1">
            <User className="w-3 h-3" /> Guardian
          </TabsTrigger>
          <TabsTrigger value="vault" className="text-xs gap-1">
            <Lock className="w-3 h-3" /> Vault
          </TabsTrigger>
        </TabsList>

        {/* ========== RECORDS TAB ========== */}
        <TabsContent value="records" className="space-y-3 mt-4">
          {/* Search & Filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                placeholder="Search records..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)} className="pl-9"
              />
            </div>
            <Button variant="outline" size="icon" onClick={() => setShowUploadForm(!showUploadForm)}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex gap-1 flex-wrap">
            <Badge variant={filterType ? "outline" : "default"} className="cursor-pointer text-xs"
              onClick={() => setFilterType(null)}>All</Badge>
            {RECORD_TYPES.map((t) => (
              <Badge key={t} variant={filterType === t ? "default" : "outline"}
                className="cursor-pointer text-xs" onClick={() => setFilterType(t)}>{t}</Badge>
            ))}
          </div>

          {/* Upload Form (collapsible) */}
          {showUploadForm && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Upload className="w-4 h-4 text-primary" /> Upload Record
                </h3>
                <Input placeholder="Title *" value={title} onChange={(e) => setTitle(e.target.value)} />
                <Select value={recordType} onValueChange={setRecordType}>
                  <SelectTrigger><SelectValue placeholder="Record type *" /></SelectTrigger>
                  <SelectContent>
                    {RECORD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="date" value={recordDate} onChange={(e) => setRecordDate(e.target.value)} />
                  <Input placeholder="Doctor" value={doctorName} onChange={(e) => setDoctorName(e.target.value)} />
                </div>
                <Input placeholder="Hospital / Clinic" value={hospitalName} onChange={(e) => setHospitalName(e.target.value)} />
                <Textarea placeholder="Notes..." value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                <Input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} />
                <div className="flex gap-2">
                  <Button onClick={handleUpload} disabled={uploading || !title || !recordType} className="flex-1">
                    {uploading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Saving...</>
                      : <><Upload className="w-4 h-4 mr-1" /> Save</>}
                  </Button>
                  <Button variant="outline" onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file"; input.accept = "image/*"; input.capture = "environment";
                    input.onchange = (e) => setSelectedFile((e.target as HTMLInputElement).files?.[0] || null);
                    input.click();
                  }}>
                    <Camera className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Records List */}
          {loadingRecords ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {records.length === 0 ? "No records yet. Tap + to add your first." : "No matching records."}
            </p>
          ) : (
            filteredRecords.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-3 flex items-center gap-3">
                  <File className="w-8 h-8 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.title}</p>
                    <div className="flex gap-2 items-center flex-wrap">
                      <Badge variant="secondary" className="text-[10px]">{r.record_type}</Badge>
                      {r.record_date && (
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(r.record_date).toLocaleDateString("en-IN")}
                        </span>
                      )}
                    </div>
                    {r.doctor_name && <p className="text-[10px] text-muted-foreground">{r.doctor_name}</p>}
                    {r.hospital_name && <p className="text-[10px] text-muted-foreground">{r.hospital_name}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {r.file_url && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDownload(r)}>
                        <Download className="w-3 h-3" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(r)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ========== HEALTH PROFILE TAB ========== */}
        <TabsContent value="profile" className="space-y-4 mt-4">
          {profileLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Heart className="w-4 h-4 text-destructive" /> Health Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>Blood Group</Label>
                    <Select value={healthProfile.blood_group}
                      onValueChange={(v) => setHealthProfile((p) => ({ ...p, blood_group: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {BLOOD_GROUPS.map((bg) => <SelectItem key={bg} value={bg}>{bg}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <ChipInput
                    label="Allergies" items={healthProfile.allergies}
                    onAdd={() => addChip("allergies", allergyInput)}
                    onRemove={(i) => removeChip("allergies", i)}
                    inputValue={allergyInput} setInputValue={setAllergyInput}
                    placeholder="e.g. Penicillin"
                  />

                  <ChipInput
                    label="Medical Conditions" items={healthProfile.chronic_conditions}
                    onAdd={() => addChip("chronic_conditions", conditionInput)}
                    onRemove={(i) => removeChip("chronic_conditions", i)}
                    inputValue={conditionInput} setInputValue={setConditionInput}
                    placeholder="e.g. Diabetes"
                  />

                  <ChipInput
                    label="Current Medications" items={healthProfile.current_medications}
                    onAdd={() => addChip("current_medications", medicationInput)}
                    onRemove={(i) => removeChip("current_medications", i)}
                    inputValue={medicationInput} setInputValue={setMedicationInput}
                    placeholder="e.g. Metformin 500mg"
                  />

                  <div>
                    <Label>Emergency Notes</Label>
                    <Textarea
                      placeholder="Any critical info for responders..."
                      value={healthProfile.emergency_notes}
                      onChange={(e) => setHealthProfile((p) => ({ ...p, emergency_notes: e.target.value }))}
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" /> Family Doctor
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>Doctor's Name</Label>
                    <Input
                      placeholder="Dr. "
                      value={healthProfile.family_doctor_name}
                      onChange={(e) => setHealthProfile((p) => ({ ...p, family_doctor_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Phone Number</Label>
                    <Input
                      placeholder="+91 98765 43210"
                      value={healthProfile.family_doctor_phone}
                      onChange={(e) => setHealthProfile((p) => ({ ...p, family_doctor_phone: e.target.value }))}
                    />
                  </div>
                </CardContent>
              </Card>

              <Button onClick={saveHealthProfile} disabled={profileSaving} className="w-full" size="lg">
                {profileSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                  : <><ShieldCheck className="w-4 h-4 mr-2" /> Save Health Profile</>}
              </Button>
            </>
          )}
        </TabsContent>

        {/* ========== GUARDIAN TAB ========== */}
        <GuardianTab userId={userId} />

        {/* ========== SECRET VAULT TAB ========== */}
        <TabsContent value="vault" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" /> Encrypted ID & Documents
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                AES-256-GCM encrypted. Only you can decrypt with your vault PIN.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {!storedPinHash ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Set up your vault PIN first (it was created when you unlocked this page).
                </p>
              ) : !vaultUnlocked ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Enter your 6-digit vault PIN to view or add encrypted documents.
                  </p>
                  <Input
                    type="password" maxLength={6} inputMode="numeric"
                    value={pinForVault} placeholder="● ● ● ● ● ●"
                    onChange={(e) => setPinForVault(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    onKeyDown={(e) => e.key === "Enter" && pinForVault.length === 6 && unlockVault()}
                  />
                  <Button onClick={unlockVault} disabled={pinForVault.length !== 6} className="w-full">
                    <Lock className="w-4 h-4 mr-2" /> Unlock Vault
                  </Button>
                </div>
              ) : (
                <>
                  {DOC_TYPES.map(({ key, label }) => {
                    const doc = encDocs.find((d) => d.doc_type === key);
                    const value = decryptedValues[key];
                    return doc ? (
                      <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className="text-sm font-mono font-medium">{value || "••••••"}</p>
                        </div>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"
                          onClick={() => handleDeleteDoc(doc.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : null;
                  })}

                  {encDocs.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      No encrypted documents yet.
                    </p>
                  )}

                  <Button variant="outline" className="w-full" onClick={() => setAddDocDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Add Encrypted Document
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Zero-knowledge AES-256-GCM encryption
          </p>
        </TabsContent>
      </Tabs>

      {/* Add Document Dialog */}
      <Dialog open={addDocDialog} onOpenChange={setAddDocDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Encrypted Document</DialogTitle>
            <DialogDescription>
              This data will be encrypted with AES-256-GCM before storage.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Document Type</Label>
              <Select value={addDocType} onValueChange={setAddDocType}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.filter(({ key }) => !encDocs.find((d) => d.doc_type === key)).map(({ key, label }) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Value</Label>
              <Input
                placeholder={DOC_TYPES.find((d) => d.key === addDocType)?.placeholder || "Enter value"}
                value={addDocValue} onChange={(e) => setAddDocValue(e.target.value)}
              />
            </div>
            <Button onClick={handleAddDoc} disabled={addingDoc || !addDocType || !addDocValue.trim()} className="w-full">
              {addingDoc ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Encrypting...</>
                : <><ShieldCheck className="w-4 h-4 mr-1" /> Encrypt & Save</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const MedicalVault = () => (
  <AppLayout>
    <VaultGate title="Medical Vault">
      <MedicalVaultContent />
    </VaultGate>
  </AppLayout>
);

export default MedicalVault;

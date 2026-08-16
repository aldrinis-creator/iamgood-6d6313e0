import AvatarImage from "@/components/AvatarImage";
import { useState, useEffect, useCallback, useMemo } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { formatScheduleTime } from "@/lib/istTime";
import {
  User, Phone, Calendar, Scale, Ruler, Heart, Shield,
  Save, Edit, ShieldCheck, Stethoscope,
  Trash2, Mail, Plus, Loader2, ChevronDown, Activity, Apple, Pill, AlertTriangle,
  Printer, MessageCircle, Share2,
} from "lucide-react";
import { differenceInYears, parse } from "date-fns";
import PhoneInput from "@/components/PhoneInput";
import PastMedicalHistory from "@/components/PastMedicalHistory";
import IdInsuranceSection from "@/components/profile/IdInsuranceSection";
import GuardianBlockedSection from "@/components/profile/GuardianBlockedSection";
import { buildLetterheadHtml } from "@/lib/reportPdf";
import { addGuardianWithInvite, resendGuardianInvite, setPrimaryGuardian } from "@/lib/guardianInvite";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";


const BMI_CATEGORIES = [
  { max: 18.5, label: "Underweight", color: "text-blue-500" },
  { max: 25, label: "Normal", color: "text-success" },
  { max: 30, label: "Overweight", color: "text-yellow-500" },
  { max: Infinity, label: "Obese", color: "text-destructive" },
];

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const ACTIVITY_LEVELS = ["Sedentary", "Light", "Moderate", "Active", "Very Active"];
const DIET_TYPES = ["vegetarian", "non-vegetarian", "vegan", "eggetarian", "pescatarian", "other"];
const PREFERENCE_OPTIONS = [
  "No Sugar", "Low Salt", "Gluten Free", "Dairy Free", "Nut Free",
  "Organic", "High Protein", "Low Carb", "Keto", "Paleo",
  "Whole Foods", "Raw Food", "Intermittent Fasting",
];
const GOAL_OPTIONS = [
  "Weight Loss", "Weight Gain", "Muscle Building", "Heart Health",
  "Diabetes Management", "Blood Pressure Control", "Better Sleep",
  "Stress Reduction", "Improved Digestion", "Bone Health",
  "Energy Boost", "Immunity Boost",
];

const FREQUENCIES: Record<string, string> = {
  once_daily: "Once daily",
  twice_daily: "Twice daily",
  three_daily: "3× daily",
  as_needed: "As needed",
};

const getBmiInfo = (bmi: number) => BMI_CATEGORIES.find((c) => bmi < c.max) ?? BMI_CATEGORIES[3];

interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  schedule_times: string[];
  remaining_quantity: number;
  total_quantity: number;
  low_stock_threshold: number;
}

const MyProfile = () => {
  const { profile } = useAuth();
  const isGuardian = profile?.role === "guardian";

  return (
    <AppLayout>
      <div className="p-4 pb-28">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-foreground">My Profile</h1>
          {!isGuardian && (
            <p className="text-sm text-muted-foreground">Protected with military-grade encryption</p>
          )}
        </div>
        {isGuardian ? (
          <GuardianBlockedSection />
        ) : (
          <VaultGate title="My Profile">
            <ProfileContent />
          </VaultGate>
        )}
      </div>
    </AppLayout>
  );
};

const MultiSelectDropdown = ({
  label,
  options,
  selected,
  onChange,
  icon,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  icon?: React.ReactNode;
}) => {
  const [customInput, setCustomInput] = useState("");

  const toggle = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((s) => s !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const addCustom = () => {
    const val = customInput.trim();
    if (val && !selected.includes(val)) {
      onChange([...selected, val]);
      setCustomInput("");
    }
  };

  return (
    <div>
      <Label className="text-xs font-medium flex items-center gap-1.5 mb-1.5">
        {icon} {label}
      </Label>
      {selected.length > 0 && (
        <div className="flex gap-1 flex-wrap mb-2">
          {selected.map((item) => (
            <Badge key={item} variant="secondary" className="text-xs cursor-pointer" onClick={() => toggle(item)}>
              {item} ✕
            </Badge>
          ))}
        </div>
      )}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-between text-sm font-normal">
            {selected.length > 0 ? `${selected.length} selected` : `Select ${label.toLowerCase()}`}
            <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 max-h-64 overflow-y-auto p-2" align="start">
          {options.map((option) => (
            <label key={option} className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer">
              <Checkbox checked={selected.includes(option)} onCheckedChange={() => toggle(option)} />
              <span className="text-sm">{option}</span>
            </label>
          ))}
          <div className="flex gap-1 mt-2 pt-2 border-t">
            <Input
              placeholder="Add custom..."
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
              className="text-sm h-8"
            />
            <Button size="sm" variant="ghost" className="h-8 px-2" onClick={addCustom}>
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
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
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [primaryCandidate, setPrimaryCandidate] = useState<any | null>(null);
  const [settingPrimary, setSettingPrimary] = useState(false);


  // Persona fields (from nutrition_personas)
  const [bloodGroup, setBloodGroup] = useState("");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [allergyInput, setAllergyInput] = useState("");
  const [medicalConditions, setMedicalConditions] = useState<string[]>([]);
  const [conditionInput, setConditionInput] = useState("");
  const [activityLevel, setActivityLevel] = useState("");
  const [smoking, setSmoking] = useState("");
  const [alcohol, setAlcohol] = useState("");
  const [dietType, setDietType] = useState("vegetarian");
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>([]);
  const [healthGoals, setHealthGoals] = useState<string[]>([]);

  // Medications (read-only)
  const [medications, setMedications] = useState<Medication[]>([]);
  // Medical history (read-only for PDF)
  const [medicalHistory, setMedicalHistory] = useState<any[]>([]);

  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!userId) return;

    const [guardianRes, healthRes, personaRes, medsRes, historyRes] = await Promise.all([
      supabase.from("guardians").select("*").eq("user_id", userId).order("is_primary", { ascending: false }),
      supabase.from("health_profile").select("*").eq("user_id", userId).limit(1),
      supabase.from("nutrition_personas").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("medications").select("*").eq("user_id", userId).order("name"),
      supabase.from("medical_history").select("*").eq("user_id", userId).order("start_date", { ascending: false }),
    ]);

    if (guardianRes.data) setGuardians(guardianRes.data);
    if (healthRes.data?.[0]) {
      setDoctorName((healthRes.data[0] as any).family_doctor_name || "");
      setDoctorPhone((healthRes.data[0] as any).family_doctor_phone || "");
    }

    // Load persona data
    if (personaRes.data) {
      const p = personaRes.data;
      setBloodGroup(p.blood_group || "");
      setAllergies(p.allergies || []);
      setMedicalConditions(p.medical_conditions || []);
      setActivityLevel(p.activity_level || "");
      setSmoking(p.smoking || "");
      setAlcohol(p.alcohol || "");
      setDietType(p.diet_type || "vegetarian");
      setDietaryPreferences(p.dietary_preferences || []);
      setHealthGoals(p.health_goals || []);
    }

    if (medsRes.data) setMedications(medsRes.data as Medication[]);
    if (historyRes.data) setMedicalHistory(historyRes.data);
  }, [userId]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setDob(profile.date_of_birth || "");
      setPhone(profile.phone || "");
      setGender((profile as any).gender || "");
      setWeightKg((profile as any).weight_kg?.toString() || "");
      setHeightM((profile as any).height_m?.toString() || "");
      setAvatarUrl((profile as any).avatar_url || "");
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

    const [profileRes, healthRes, personaRes] = await Promise.all([
      supabase.from("profiles").update({
        full_name: fullName,
        date_of_birth: dob || null,
        phone: phone || null,
        gender: gender || null,
        weight_kg: weightKg ? parseFloat(weightKg) : null,
        height_m: heightM ? parseFloat(heightM) : null,
        avatar_url: avatarUrl || null,
      } as any).eq("id", userId),
      supabase.from("health_profile").upsert({
        user_id: userId,
        family_doctor_name: doctorName || null,
        family_doctor_phone: doctorPhone || null,
        blood_group: bloodGroup || null,
        allergies,
        chronic_conditions: medicalConditions,
      } as any, { onConflict: "user_id" }),
      supabase.from("nutrition_personas").upsert({
        user_id: userId,
        blood_group: bloodGroup || null,
        allergies,
        medical_conditions: medicalConditions,
        activity_level: activityLevel || null,
        smoking: smoking || null,
        alcohol: alcohol || null,
        diet_type: dietType,
        dietary_preferences: dietaryPreferences,
        health_goals: healthGoals,
      } as any, { onConflict: "user_id" }),
    ]);

    setSaving(false);
    if (profileRes.error || healthRes.error || personaRes.error) {
      toast.error("Failed to save profile");
    } else {
      toast.success("Profile updated");
      setEditing(false);
      await refreshProfile();
    }
  };

  const handleAvatarUpload = async (file: File) => {
    if (!userId) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB");
      return;
    }
    setUploadingAvatar(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
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
    toast.success("Photo uploaded — tap Save to keep it");
  };

  const addChip = (setter: React.Dispatch<React.SetStateAction<string[]>>, value: string) => {
    if (!value.trim()) return;
    setter((prev) => [...prev, value.trim()]);
  };

  const removeChip = (setter: React.Dispatch<React.SetStateAction<string[]>>, idx: number) => {
    setter((prev) => prev.filter((_, i) => i !== idx));
  };

    const buildProfileText = () => {
      const lines: string[] = [];
      lines.push(`Name: ${fullName || "—"}`);
      lines.push(`Date of Birth: ${dob ? `${dob} (${age} yrs)` : "—"}`);
      lines.push(`Mobile: ${phone || "—"}`);
      lines.push(`Gender: ${gender || "—"}`);
      lines.push(`Weight: ${weightKg ? `${weightKg} kg` : "—"}`);
      lines.push(`Height: ${heightM ? `${heightM} m` : "—"}`);
      if (bmi && bmiInfo) lines.push(`BMI: ${bmi.toFixed(1)} — ${bmiInfo.label}`);
      lines.push("");
      lines.push(`Blood Group: ${bloodGroup || "—"}`);
      lines.push(`Diet Type: ${dietType || "—"}`);
      lines.push(`Allergies: ${allergies.length > 0 ? allergies.join(", ") : "—"}`);
      lines.push(`Medical Conditions: ${medicalConditions.length > 0 ? medicalConditions.join(", ") : "—"}`);
      lines.push(`Activity Level: ${activityLevel || "—"}`);
      lines.push(`Smoking: ${smoking || "—"}`);
      lines.push(`Alcohol: ${alcohol || "—"}`);
      if (dietaryPreferences.length > 0) lines.push(`Dietary Preferences: ${dietaryPreferences.join(", ")}`);
      if (healthGoals.length > 0) lines.push(`Health Goals: ${healthGoals.join(", ")}`);
      lines.push("");
      lines.push(`Family Doctor: ${doctorName || "—"}`);
      lines.push(`Doctor Phone: ${doctorPhone || "—"}`);
      if (guardians.length > 0) {
        lines.push("");
        lines.push("Guardians:");
        guardians.forEach((g) => {
          lines.push(`  • ${g.guardian_name} (${g.relation || "—"}) — ${g.guardian_phone}`);
        });
      }
      if (medications.length > 0) {
        lines.push("");
        lines.push("Current Medications:");
        medications.forEach((med) => {
          lines.push(`  • ${med.name} — ${med.dosage}, ${FREQUENCIES[med.frequency] || med.frequency}`);
        });
      }
      const hospitalizations = medicalHistory.filter((h) => h.type === "hospitalization");
      const surgeries = medicalHistory.filter((h) => h.type === "surgery");
      if (hospitalizations.length > 0) {
        lines.push("");
        lines.push("Past Hospitalizations:");
        hospitalizations.forEach((h) => {
          lines.push(`  • ${h.reason}${h.hospital_name ? ` at ${h.hospital_name}` : ""}${h.start_date ? ` (${h.start_date}${h.end_date ? ` to ${h.end_date}` : ""})` : ""}`);
          if (h.treatment) lines.push(`    Treatment: ${h.treatment}`);
          if (h.medications) lines.push(`    Medications: ${h.medications}`);
        });
      }
      if (surgeries.length > 0) {
        lines.push("");
        lines.push("Past Surgeries:");
        surgeries.forEach((s) => {
          lines.push(`  • ${s.reason}${s.nature ? ` (${s.nature})` : ""}${s.hospital_name ? ` at ${s.hospital_name}` : ""}${s.start_date ? ` on ${s.start_date}` : ""}`);
          if (s.doctor_name) lines.push(`    Doctor: ${s.doctor_name}`);
          if (s.advice) lines.push(`    Advice: ${s.advice}`);
        });
      }
      return lines.join("\n");
    };

    const buildProfileHtml = () => {
      const row = (label: string, value: string) =>
        `<div class="row"><span class="label">${label}</span><span class="value">${value || "—"}</span></div>`;

      let html = `<div class="section"><div class="section-title">👤 Personal Information</div><div class="section-body">`;
      html += row("Full Name", fullName);
      html += row("Date of Birth", dob ? `${dob} (${age} yrs)` : "—");
      html += row("Mobile", phone);
      html += row("Gender", gender ? gender.charAt(0).toUpperCase() + gender.slice(1) : "—");
      html += `</div></div>`;

      html += `<div class="section"><div class="section-title">⚖️ Body Metrics</div><div class="section-body">`;
      html += row("Weight", weightKg ? `${weightKg} kg` : "—");
      html += row("Height", heightM ? `${heightM} m` : "—");
      if (bmi && bmiInfo) html += row("BMI", `${bmi.toFixed(1)} — ${bmiInfo.label}`);
      html += `</div></div>`;

      html += `<div class="section"><div class="section-title">❤️ Body & Health</div><div class="section-body">`;
      html += row("Blood Group", bloodGroup);
      html += row("Diet Type", dietType ? dietType.replace("-", " ") : "—");
      html += row("Allergies", allergies.length > 0 ? allergies.map(a => `<span class="badge">${a}</span>`).join(" ") : "—");
      html += row("Medical Conditions", medicalConditions.length > 0 ? medicalConditions.map(c => `<span class="badge">${c}</span>`).join(" ") : "—");
      html += row("Activity Level", activityLevel ? activityLevel.charAt(0).toUpperCase() + activityLevel.slice(1) : "—");
      html += row("Smoking", smoking ? smoking.charAt(0).toUpperCase() + smoking.slice(1) : "—");
      html += row("Alcohol", alcohol ? alcohol.charAt(0).toUpperCase() + alcohol.slice(1) : "—");
      if (dietaryPreferences.length > 0) html += row("Dietary Preferences", dietaryPreferences.map(d => `<span class="badge-blue badge">${d}</span>`).join(" "));
      if (healthGoals.length > 0) html += row("Health Goals", healthGoals.map(g => `<span class="badge-green badge">${g}</span>`).join(" "));
      html += `</div></div>`;

      html += `<div class="section"><div class="section-title">🩺 Family Doctor</div><div class="section-body">`;
      html += row("Doctor Name", doctorName);
      html += row("Doctor Phone", doctorPhone);
      html += `</div></div>`;

      if (guardians.length > 0) {
        html += `<div class="section"><div class="section-title">🛡️ Guardians</div><div class="section-body">`;
        guardians.forEach((g) => {
          html += `<div class="row"><span class="label">${g.guardian_name}${g.relation ? ` (${g.relation})` : ""}</span><span class="value">${g.guardian_phone}</span></div>`;
        });
        html += `</div></div>`;
      }

      if (medications.length > 0) {
        html += `<div class="section"><div class="section-title">💊 Current Medications</div><div class="section-body">`;
        html += `<table><tr><th>Name</th><th>Dosage</th><th>Frequency</th><th>Stock</th></tr>`;
        medications.forEach((med) => {
          const isLow = med.remaining_quantity <= med.low_stock_threshold;
          html += `<tr><td>${med.name}</td><td>${med.dosage}</td><td>${FREQUENCIES[med.frequency] || med.frequency}</td><td style="${isLow ? "color:#dc2626;font-weight:600" : ""}">${med.remaining_quantity}/${med.total_quantity}${isLow ? " ⚠️" : ""}</td></tr>`;
        });
        html += `</table></div></div>`;
      }

      const hospitalizations = medicalHistory.filter((h) => h.type === "hospitalization");
      const surgeries = medicalHistory.filter((h) => h.type === "surgery");

      if (hospitalizations.length > 0) {
        html += `<div class="section"><div class="section-title">🏥 Past Hospitalizations</div><div class="section-body">`;
        html += `<table><tr><th>Reason</th><th>Hospital</th><th>Period</th><th>Treatment</th></tr>`;
        hospitalizations.forEach((h) => {
          const period = h.start_date ? `${h.start_date}${h.end_date ? ` — ${h.end_date}` : ""}` : "—";
          html += `<tr><td>${h.reason}</td><td>${h.hospital_name || "—"}</td><td>${period}</td><td>${h.treatment || "—"}</td></tr>`;
        });
        html += `</table></div></div>`;
      }

      if (surgeries.length > 0) {
        html += `<div class="section"><div class="section-title">✂️ Past Surgeries</div><div class="section-body">`;
        html += `<table><tr><th>Reason</th><th>Nature</th><th>Doctor</th><th>Date</th></tr>`;
        surgeries.forEach((s) => {
          html += `<tr><td>${s.reason}</td><td>${s.nature || "—"}</td><td>${s.doctor_name || "—"}</td><td>${s.start_date || "—"}</td></tr>`;
        });
        html += `</table></div></div>`;
      }

      return html;
    };

    const handlePrintProfile = () => {
      const html = buildLetterheadHtml({
        title: "My Health Profile",
        subtitle: fullName || "Health Profile Report",
        bodyHtml: buildProfileHtml(),
        includeDisclaimer: false,
      });
      const win = window.open("", "_blank");
      if (!win) return;
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 400);
    };

    const handleShareWhatsApp = () => {
      const text = `*My Health Profile*\nCheck-iN\n${new Date().toLocaleDateString("en-IN")}\n\n${buildProfileText()}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    };

    const handleShareEmail = () => {
      const subject = "My Health Profile — Check-iN";
      const body = `My Health Profile\nDate: ${new Date().toLocaleDateString("en-IN")}\n\n${buildProfileText()}`;
      window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_self");
    };

    return (
    <div className="space-y-4">
      {/* Edit toggle + Share actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5 print:hidden">
          <Button size="sm" variant="outline" className="gap-1" onClick={handlePrintProfile}>
            <Printer className="w-3.5 h-3.5" /> PDF
          </Button>
          <Button size="sm" variant="outline" className="gap-1 text-success border-success/30 hover:bg-success/10" onClick={handleShareWhatsApp}>
            <MessageCircle className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="outline" className="gap-1" onClick={handleShareEmail}>
            <Mail className="w-3.5 h-3.5" />
          </Button>
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
              <div className="flex items-center gap-3 mb-4">
                <div className="w-16 h-16 rounded-full bg-muted overflow-hidden flex items-center justify-center border">
                  <AvatarImage
                    value={avatarUrl}
                    className="w-full h-full object-cover"
                    fallback={<User className="w-7 h-7 text-muted-foreground" />}
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
              <div><Label>Full Name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="text-base" /></div>
              <div><Label>Date of Birth</Label><Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="text-base" /></div>
              <div><Label>Mobile Number</Label><PhoneInput value={phone} onChange={setPhone} /></div>
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
              <div className="flex justify-center mb-4">
                <div className="w-20 h-20 rounded-full bg-muted overflow-hidden flex items-center justify-center border shadow-sm">
                  <AvatarImage
                    value={avatarUrl}
                    className="w-full h-full object-cover"
                    fallback={<User className="w-10 h-10 text-muted-foreground" />}
                  />

                </div>
              </div>
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
              <div><Label>Weight (kg)</Label><Input type="number" step="0.1" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} className="text-base" /></div>
              <div><Label>Height (m)</Label><Input type="number" step="0.01" value={heightM} onChange={(e) => setHeightM(e.target.value)} className="text-base" /></div>
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

      {/* My Persona — Body & Health */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Heart className="w-4 h-4 text-destructive" /> Body & Health
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {editing ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Blood Group</Label>
                  <Select value={bloodGroup} onValueChange={setBloodGroup}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {BLOOD_GROUPS.map((bg) => <SelectItem key={bg} value={bg}>{bg}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Diet Type</Label>
                  <Select value={dietType} onValueChange={setDietType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DIET_TYPES.map((d) => <SelectItem key={d} value={d} className="capitalize">{d.replace("-", " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Allergies</Label>
                <div className="flex gap-1 flex-wrap mb-1">
                  {allergies.map((a, i) => (
                    <Badge key={i} variant="secondary" className="text-xs cursor-pointer" onClick={() => removeChip(setAllergies, i)}>{a} ✕</Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input placeholder="e.g. Penicillin" value={allergyInput} onChange={(e) => setAllergyInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addChip(setAllergies, allergyInput); setAllergyInput(""); } }} className="text-base" />
                  <Button variant="outline" size="sm" onClick={() => { addChip(setAllergies, allergyInput); setAllergyInput(""); }}><Plus className="w-3 h-3" /></Button>
                </div>
              </div>
              <div>
                <Label className="text-xs">Medical Conditions</Label>
                <div className="flex gap-1 flex-wrap mb-1">
                  {medicalConditions.map((c, i) => (
                    <Badge key={i} variant="secondary" className="text-xs cursor-pointer" onClick={() => removeChip(setMedicalConditions, i)}>{c} ✕</Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input placeholder="e.g. Diabetes" value={conditionInput} onChange={(e) => setConditionInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addChip(setMedicalConditions, conditionInput); setConditionInput(""); } }} className="text-base" />
                  <Button variant="outline" size="sm" onClick={() => { addChip(setMedicalConditions, conditionInput); setConditionInput(""); }}><Plus className="w-3 h-3" /></Button>
                </div>
              </div>
              <div>
                <Label className="text-xs">Activity Level</Label>
                <Select value={activityLevel} onValueChange={setActivityLevel}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_LEVELS.map((a) => <SelectItem key={a} value={a.toLowerCase()}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Smoking</Label>
                  <Select value={smoking} onValueChange={setSmoking}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Never</SelectItem>
                      <SelectItem value="former">Former</SelectItem>
                      <SelectItem value="current">Current</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Alcohol</Label>
                  <Select value={alcohol} onValueChange={setAlcohol}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Never</SelectItem>
                      <SelectItem value="occasional">Occasional</SelectItem>
                      <SelectItem value="regular">Regular</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <MultiSelectDropdown
                label="Dietary Preferences"
                options={PREFERENCE_OPTIONS}
                selected={dietaryPreferences}
                onChange={setDietaryPreferences}
                icon={<Apple className="w-3.5 h-3.5" />}
              />
              <MultiSelectDropdown
                label="Health Goals"
                options={GOAL_OPTIONS}
                selected={healthGoals}
                onChange={setHealthGoals}
                icon={<Activity className="w-3.5 h-3.5" />}
              />
            </>
          ) : (
            <div className="space-y-2 text-sm">
              <InfoRow label="Blood Group" value={bloodGroup} />
              <InfoRow label="Diet Type" value={dietType} capitalize />
              <InfoRow label="Allergies" value={allergies.length > 0 ? allergies.join(", ") : "—"} />
              <InfoRow label="Medical Conditions" value={medicalConditions.length > 0 ? medicalConditions.join(", ") : "—"} />
              <InfoRow label="Activity Level" value={activityLevel} capitalize />
              <InfoRow label="Smoking" value={smoking} capitalize />
              <InfoRow label="Alcohol" value={alcohol} capitalize />
              <InfoRow label="Dietary Preferences" value={dietaryPreferences.length > 0 ? dietaryPreferences.join(", ") : "—"} />
              <InfoRow label="Health Goals" value={healthGoals.length > 0 ? healthGoals.join(", ") : "—"} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past Medical History */}
      <PastMedicalHistory editing={editing} />

      {/* ID & Insurance — Hospital Kit */}
      <IdInsuranceSection />

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
              <div><Label>Doctor Name</Label><Input value={doctorName} onChange={(e) => setDoctorName(e.target.value)} placeholder="Dr. Sharma" className="text-base" /></div>
              <div><Label>Doctor Mobile</Label><PhoneInput value={doctorPhone} onChange={setDoctorPhone} /></div>
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

      {/* Guardians Management */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" /> My Guardians
            <span className="text-xs text-muted-foreground font-normal ml-auto">{guardians.length}/5</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {guardians.length > 0 ? guardians.map((g) => (
            <div key={g.id} className="p-3 rounded-lg bg-muted/50 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{g.guardian_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {g.relation && <span className="capitalize">{g.relation} • </span>}{g.guardian_phone}
                  </p>
                  {g.guardian_email && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Mail className="w-3 h-3" />{g.guardian_email}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {g.is_primary && (
                    <Badge className="text-xs">Primary</Badge>
                  )}
                  {g.status && g.status !== "accepted" && (
                    <Badge variant="outline" className="text-[10px] capitalize">{g.status}</Badge>
                  )}
                  <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
                    <a href={`tel:${g.guardian_phone}`}><Phone className="w-3.5 h-3.5 text-primary" /></a>
                  </Button>
                  {!g.is_primary && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={async () => {
                        const { error } = await supabase.from("guardians").delete().eq("id", g.id);
                        if (error) toast.error("Failed to remove guardian");
                        else { toast.success("Guardian removed"); loadData(); }
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {!g.is_primary && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs gap-1 h-7"
                    onClick={() => setPrimaryCandidate(g)}
                  >
                    <ShieldCheck className="w-3 h-3" /> Make Primary
                  </Button>
                )}
                {g.status !== "accepted" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs gap-1 h-7"
                    disabled={resendingId === g.id}
                    onClick={async () => {
                      setResendingId(g.id);
                      await resendGuardianInvite(g.id, fullName || "Your ward");
                      setResendingId(null);
                    }}
                  >
                    {resendingId === g.id
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <Mail className="w-3 h-3" />} Re-send invite
                  </Button>
                )}
              </div>
            </div>
          )) : (
            <p className="text-sm text-muted-foreground text-center py-2">No guardians added yet</p>
          )}


          {showGuardianForm ? (
            <div className="space-y-3 p-3 rounded-lg border border-border">
              <div><Label className="text-xs">Name *</Label><Input value={gName} onChange={(e) => setGName(e.target.value)} placeholder="Guardian name" className="text-base" /></div>
              <div><Label className="text-xs">Phone *</Label><PhoneInput value={gPhone} onChange={setGPhone} /></div>
              <div><Label className="text-xs">Email * (for emergency notifications)</Label><Input value={gEmail} onChange={(e) => setGEmail(e.target.value)} placeholder="guardian@email.com" type="email" className="text-base" /></div>
              <div>
                <Label className="text-xs">Relation</Label>
                <Select value={gRelation} onValueChange={setGRelation}>
                  <SelectTrigger><SelectValue placeholder="Select relation" /></SelectTrigger>
                  <SelectContent>
                    {["Spouse", "Son", "Daughter", "Sibling", "Friend", "Neighbor", "Other"].map((r) => (
                      <SelectItem key={r} value={r.toLowerCase()}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  disabled={addingGuardian}
                  onClick={async () => {
                    if (!gName.trim() || !gPhone.trim() || !gEmail.trim()) {
                      toast.error("Name, phone and email are required");
                      return;
                    }
                    setAddingGuardian(true);
                    const { error } = await addGuardianWithInvite({
                      userId: userId!,
                      guardianName: gName,
                      guardianPhone: gPhone,
                      guardianEmail: gEmail,
                      relation: gRelation,
                      isPrimary: guardians.length === 0,
                      userName: fullName || "Your ward",
                    });
                    if (error) toast.error("Failed to add guardian");
                    else {
                      toast.success("Guardian added");
                      setGName(""); setGPhone(""); setGEmail(""); setGRelation("");
                      setShowGuardianForm(false);
                      loadData();
                    }
                    setAddingGuardian(false);

                  }}
                >
                  {addingGuardian && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                  Add Guardian
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setShowGuardianForm(false)}>Cancel</Button>
              </div>
            </div>
          ) : guardians.length < 5 ? (
            <Button variant="outline" className="w-full" onClick={() => setShowGuardianForm(true)}>
              <Plus className="w-4 h-4 mr-1" /> Add Guardian
            </Button>
          ) : null}

          <p className="text-[11px] text-muted-foreground">
            Guardian email is essential — emergency alerts are sent via email and SMS/WhatsApp.
          </p>
        </CardContent>
      </Card>

      <AlertDialog open={!!primaryCandidate} onOpenChange={(o) => !o && setPrimaryCandidate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Primary Guardian?</AlertDialogTitle>
            <AlertDialogDescription>
              {primaryCandidate?.guardian_name} will become your Primary Guardian
              {guardians.find((x) => x.is_primary)
                ? `, and ${guardians.find((x) => x.is_primary)?.guardian_name} will become a secondary guardian.`
                : "."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={settingPrimary}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={settingPrimary}
              onClick={async (e) => {
                e.preventDefault();
                if (!userId || !primaryCandidate) return;
                setSettingPrimary(true);
                const ok = await setPrimaryGuardian(userId, primaryCandidate.id);
                setSettingPrimary(false);
                setPrimaryCandidate(null);
                if (ok) loadData();
              }}
            >
              {settingPrimary && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Make Primary
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* Current Medications (read-only from medications table) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Pill className="w-4 h-4 text-primary" /> Current Medications
            <span className="text-xs text-muted-foreground font-normal ml-auto">{medications.length} active</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {medications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No medications added yet. Add them from the Tablets tab.
            </p>
          ) : (
            medications.map((med) => {
              const isLowStock = med.remaining_quantity <= med.low_stock_threshold;
              return (
                <div key={med.id} className={`flex items-center gap-3 p-3 rounded-lg bg-muted/50 ${isLowStock ? "border border-destructive/30" : ""}`}>
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Pill className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{med.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {med.dosage} · {FREQUENCIES[med.frequency] || med.frequency}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {med.schedule_times.map((t) => formatScheduleTime(t)).join(", ")}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground">
                        Stock: {med.remaining_quantity}/{med.total_quantity}
                      </span>
                      {isLowStock && (
                        <Badge variant="destructive" className="text-[10px]">
                          <AlertTriangle className="w-3 h-3 mr-0.5" /> Low
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
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

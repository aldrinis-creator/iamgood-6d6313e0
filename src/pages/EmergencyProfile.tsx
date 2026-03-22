import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Heart, Phone, Pill, Shield, User, AlertTriangle, Stethoscope } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface EmergencyData {
  name: string;
  dob: string | null;
  gender: string | null;
  phone: string | null;
  blood_group: string | null;
  allergies: string[];
  medical_conditions: string[];
  emergency_notes: string | null;
  family_doctor_name: string | null;
  family_doctor_phone: string | null;
  medications: { name: string; dosage: string }[];
  guardians: { name: string; phone: string; relation: string | null }[];
}

const EmergencyProfile = () => {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<EmergencyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    // Set noindex meta tag
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!token) { setNotFound(true); setLoading(false); return; }

      // Look up token (anon can read active tokens)
      const { data: tokenRow, error: tokenErr } = await supabase
        .from("emergency_share_tokens" as any)
        .select("user_id")
        .eq("token", token)
        .eq("is_active", true)
        .maybeSingle();

      if (tokenErr || !tokenRow) { setNotFound(true); setLoading(false); return; }
      const userId = (tokenRow as any).user_id;

      // Fetch all data in parallel (anon RLS allows it for active tokens)
      const [profileRes, healthRes, medsRes, guardiansRes] = await Promise.all([
        supabase.from("profiles").select("full_name, date_of_birth, gender, phone").eq("id", userId).maybeSingle(),
        supabase.from("health_profile").select("blood_group, allergies, chronic_conditions, emergency_notes, family_doctor_name, family_doctor_phone").eq("user_id", userId).maybeSingle(),
        supabase.from("medications").select("name, dosage").eq("user_id", userId),
        supabase.from("guardians").select("guardian_name, guardian_phone, relation").eq("user_id", userId),
      ]);

      const p = profileRes.data;
      const h = healthRes.data;

      setData({
        name: p?.full_name || "Unknown",
        dob: p?.date_of_birth || null,
        gender: p?.gender || null,
        phone: p?.phone || null,
        blood_group: h?.blood_group || null,
        allergies: (h?.allergies as string[]) || [],
        medical_conditions: (h?.chronic_conditions as string[]) || [],
        emergency_notes: h?.emergency_notes || null,
        family_doctor_name: h?.family_doctor_name || null,
        family_doctor_phone: h?.family_doctor_phone || null,
        medications: (medsRes.data || []).map((m: any) => ({ name: m.name, dosage: m.dosage })),
        guardians: (guardiansRes.data || []).map((g: any) => ({ name: g.guardian_name, phone: g.guardian_phone, relation: g.relation })),
      });
      setLoading(false);
    };

    fetchProfile();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground text-lg">Loading emergency profile…</div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-3">
            <Shield className="w-12 h-12 text-muted-foreground mx-auto" />
            <h1 className="text-xl font-bold">Profile Not Found</h1>
            <p className="text-muted-foreground">This emergency profile link is invalid or sharing has been disabled by the user.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="bg-destructive text-destructive-foreground rounded-xl p-5 text-center">
          <h1 className="text-2xl font-bold">🚨 EMERGENCY HEALTH CARD</h1>
          <p className="text-sm opacity-90 mt-1">Check-iN Emergency Response System</p>
        </div>

        {/* Personal Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4 text-primary" /> Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <InfoRow label="Name" value={data.name} />
            {data.dob && <InfoRow label="Date of Birth" value={new Date(data.dob).toLocaleDateString("en-IN")} />}
            {data.gender && <InfoRow label="Gender" value={data.gender} capitalize />}
            {data.phone && <InfoRow label="Phone" value={data.phone} />}
            {data.blood_group && (
              <div className="flex justify-between items-center py-1">
                <span className="text-sm text-muted-foreground">Blood Group</span>
                <Badge variant="destructive" className="text-sm">{data.blood_group}</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Allergies Alert */}
        {data.allergies.length > 0 && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                <span className="font-bold text-destructive text-sm">ALLERGIES</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {data.allergies.map((a, i) => <Badge key={i} variant="destructive" className="text-xs">{a}</Badge>)}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Medical Conditions */}
        {data.medical_conditions.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Heart className="w-4 h-4 text-primary" /> Medical Conditions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {data.medical_conditions.map((c, i) => <Badge key={i} variant="secondary" className="text-xs">{c}</Badge>)}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Medications */}
        {data.medications.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Pill className="w-4 h-4 text-primary" /> Current Medications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.medications.map((m, i) => (
                <div key={i} className="flex items-center justify-between py-1 border-b border-border last:border-0">
                  <span className="text-sm font-medium">{m.name}</span>
                  <span className="text-sm text-muted-foreground">{m.dosage}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Emergency Notes */}
        {data.emergency_notes && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-primary" /> Emergency Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{data.emergency_notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Family Doctor */}
        {data.family_doctor_name && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-primary" /> Family Doctor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <InfoRow label="Name" value={data.family_doctor_name} />
              {data.family_doctor_phone && <InfoRow label="Phone" value={data.family_doctor_phone} />}
            </CardContent>
          </Card>
        )}

        {/* Emergency Contacts */}
        {data.guardians.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="w-4 h-4 text-primary" /> Emergency Contacts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.guardians.map((g, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{g.name}</p>
                    {g.relation && <p className="text-xs text-muted-foreground capitalize">{g.relation}</p>}
                  </div>
                  <a href={`tel:${g.phone}`} className="text-sm text-primary font-medium">{g.phone}</a>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground pb-4">
          Auto-generated by Check-iN Emergency Response System
        </p>
      </div>
    </div>
  );
};

const InfoRow = ({ label, value, capitalize }: { label: string; value: string; capitalize?: boolean }) => (
  <div className="flex justify-between items-center py-1">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className={`text-sm font-medium ${capitalize ? "capitalize" : ""}`}>{value}</span>
  </div>
);

export default EmergencyProfile;

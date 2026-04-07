import { useEffect, useCallback, useRef } from "react";
import { useFallDetection } from "@/hooks/useFallDetection";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const FallDetectionOverlay = () => {
  const { fallDetected, countdown, cancelFallAlert, countdownExpired, permissionState, requestPermission, enabled, fallConfidence } = useFallDetection();
  const { triggerSOS } = useApp();
  const { session } = useAuth();
  const hasSentRef = useRef(false);

  const sendFallAlerts = useCallback(async () => {
    if (!session?.user?.id) return;
    const uid = session.user.id;

    const [profileRes, hpRes, gRes, npRes] = await Promise.all([
      supabase.from("profiles").select("full_name, phone, date_of_birth").eq("id", uid).maybeSingle(),
      supabase.from("health_profile").select("blood_group, allergies, chronic_conditions, current_medications, family_doctor_name, family_doctor_phone").eq("user_id", uid).maybeSingle(),
      supabase.from("guardians").select("guardian_name, guardian_phone, guardian_email, relation").eq("user_id", uid),
      supabase.from("nutrition_personas").select("blood_group, allergies, medical_conditions").eq("user_id", uid).maybeSingle(),
    ]);

    const userName = profileRes.data?.full_name || "User";
    const phone = profileRes.data?.phone || "";
    const dob = profileRes.data?.date_of_birth || "";
    const rawHp = hpRes.data;
    const np = npRes.data as any;
    const hp = {
      blood_group: rawHp?.blood_group || np?.blood_group || null,
      allergies: rawHp?.allergies?.length ? rawHp.allergies : (np?.allergies ?? []),
      chronic_conditions: rawHp?.chronic_conditions?.length ? rawHp.chronic_conditions : (np?.medical_conditions ?? []),
      current_medications: rawHp?.current_medications ?? [],
      family_doctor_name: rawHp?.family_doctor_name ?? null,
      family_doctor_phone: rawHp?.family_doctor_phone ?? null,
    };
    const guardians = gRes.data || [];

    const confidenceLabel = fallConfidence >= 0.8 ? "High" : fallConfidence >= 0.6 ? "Moderate" : "Low";
    let msg = `🚨 FALL DETECTED (${confidenceLabel} confidence) — SOS ALERT from ${userName}!`;
    if (phone) msg += `\n📞 Phone: ${phone}`;
    if (dob) msg += `\n🎂 DOB: ${dob}`;

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
      });
      msg += `\n📍 Location: https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`;
    } catch {}

    if (hp?.blood_group) msg += `\n🩸 Blood Type: ${hp.blood_group}`;
    if (hp?.allergies?.length) msg += `\n⚠️ Allergies: ${hp.allergies.join(", ")}`;
    if (hp?.chronic_conditions?.length) msg += `\n💊 Conditions: ${hp.chronic_conditions.join(", ")}`;
    if (hp?.current_medications?.length) msg += `\n💊 Medications: ${hp.current_medications.join(", ")}`;
    if (hp?.family_doctor_name) {
      msg += `\n👨‍⚕️ Family Doctor: ${hp.family_doctor_name}`;
      if (hp.family_doctor_phone) msg += ` (${hp.family_doctor_phone})`;
    }
    msg += "\n\n⚠️ A fall was detected. Please respond immediately!";

    const guardianEmails = guardians.map((g) => g.guardian_email).filter(Boolean) as string[];
    const guardianPhones = guardians.map((g) => g.guardian_phone).filter(Boolean) as string[];

    try {
      const { data: result } = await supabase.functions.invoke("send-sos-alert", {
        body: {
          user_id: uid,
          message: msg,
          guardian_emails: guardianEmails,
          guardian_phones: guardianPhones,
          doctor_email: null,
          doctor_name: hp?.family_doctor_name || null,
          user_name: userName,
        },
      });
      if (!result?.msg91Sent) {
        guardians.forEach((g, i) => {
          const cleanPhone = g.guardian_phone.replace(/[^0-9]/g, "");
          const phoneWithCode = cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;
          setTimeout(() => {
            window.open(`https://wa.me/${phoneWithCode}?text=${encodeURIComponent(msg)}`, "_blank");
          }, i * 500);
        });
      }
    } catch (e) {
      console.error("Failed to send fall detection alerts:", e);
      guardians.forEach((g, i) => {
        const cleanPhone = g.guardian_phone.replace(/[^0-9]/g, "");
        const phoneWithCode = cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;
        setTimeout(() => {
          window.open(`https://wa.me/${phoneWithCode}?text=${encodeURIComponent(msg)}`, "_blank");
        }, i * 500);
      });
    }
  }, [session?.user?.id, fallConfidence]);

  useEffect(() => {
    if (countdownExpired && !hasSentRef.current) {
      hasSentRef.current = true;
      triggerSOS();
      sendFallAlerts();
      cancelFallAlert();
    }
  }, [countdownExpired, triggerSOS, sendFallAlerts, cancelFallAlert]);

  useEffect(() => {
    if (fallDetected) {
      hasSentRef.current = false;
    }
  }, [fallDetected]);

  useEffect(() => {
    if (enabled && permissionState === "unknown") {
      requestPermission();
    }
  }, [enabled, permissionState, requestPermission]);

  if (!fallDetected) return null;

  const progress = (countdown / 15) * 100;
  const confidencePercent = Math.round(fallConfidence * 100);
  const confidenceLabel = fallConfidence >= 0.8 ? "High" : fallConfidence >= 0.6 ? "Moderate" : "Low";

  return (
    <div className="fixed inset-0 z-[100] bg-destructive/95 flex flex-col items-center justify-center text-destructive-foreground p-6 animate-in fade-in duration-300">
      <div className="w-24 h-24 rounded-full bg-destructive-foreground/20 flex items-center justify-center mb-6 animate-pulse">
        <AlertTriangle className="w-14 h-14" />
      </div>

      <h1 className="text-2xl font-bold mb-2">Fall Detected!</h1>
      
      <div className="bg-destructive-foreground/10 rounded-lg px-4 py-2 mb-4">
        <p className="text-sm font-medium">
          Confidence: {confidenceLabel} ({confidencePercent}%)
        </p>
      </div>

      <p className="text-center text-sm opacity-90 mb-8 max-w-xs">
        A fall has been detected. Emergency SOS will trigger automatically unless you cancel.
      </p>

      <div className="relative w-32 h-32 mb-8">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4" opacity={0.2} />
          <circle
            cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4"
            strokeDasharray={`${2 * Math.PI * 45}`}
            strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-4xl font-bold">{countdown}</span>
        </div>
      </div>

      <p className="text-sm opacity-80 mb-6">
        SOS in {countdown} second{countdown !== 1 ? "s" : ""}
      </p>

      <Button
        onClick={cancelFallAlert}
        variant="outline"
        size="lg"
        className="bg-destructive-foreground text-destructive hover:bg-destructive-foreground/90 border-none font-bold text-lg px-10 py-6"
      >
        <X className="w-5 h-5 mr-2" /> I'm OK — Cancel
      </Button>
    </div>
  );
};

export default FallDetectionOverlay;

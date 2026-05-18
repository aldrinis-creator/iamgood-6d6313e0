import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BriefcaseMedical, ChevronRight, Bell, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { SLOT_KEYS, resolveSlotRows } from "@/lib/hospitalKitSlots";

interface Props {
  wardUserId: string;
  wardName: string;
}

const TOTAL_SLOTS = SLOT_KEYS.length;
const SLOT_LABELS: Record<string, string> = {
  aadhaar: "Aadhaar",
  pan: "PAN",
  insurance_primary: "Insurance (Primary)",
  insurance_secondary: "Insurance (Secondary)",
  id_photo: "Passport Photo",
};

const HospitalKitCard = ({ wardUserId, wardName }: Props) => {
  const navigate = useNavigate();
  const [filledSlots, setFilledSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [nudging, setNudging] = useState(false);

  const fetchCount = useCallback(async () => {
    const { data } = await supabase
      .from("medical_records")
      .select("id, record_slot, record_type, file_url, file_name")
      .eq("user_id", wardUserId);
    const resolved = resolveSlotRows((data || []) as any);
    setFilledSlots(Object.keys(resolved));
    setLoading(false);
  }, [wardUserId]);

  useEffect(() => { fetchCount(); }, [fetchCount]);

  useEffect(() => {
    if (!wardUserId) return;
    const channel = supabase
      .channel(`hospital-kit-${wardUserId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "medical_records", filter: `user_id=eq.${wardUserId}` },
        () => fetchCount()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [wardUserId, fetchCount]);

  const missing = Object.keys(SLOT_LABELS).filter(k => !filledSlots.includes(k));
  const count = filledSlots.length;

  const handleNudge = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!missing.length) return;
    setNudging(true);
    try {
      const missingLabels = missing.map(k => SLOT_LABELS[k]).join(", ");
      const { error } = await supabase.rpc("insert_notification_deduped", {
        p_user_id: wardUserId,
        p_title: "Hospital ID docs needed",
        p_message: `Your guardian needs these for hospital admission: ${missingLabels}. Please upload them in My Profile → ID & Insurance.`,
        p_type: "id_doc_missing",
      });
      if (error) throw error;
      toast.success(`${wardName} notified`);
    } catch (e: any) {
      toast.error(e?.message || "Nudge failed");
    } finally {
      setNudging(false);
    }
  };

  const openKit = () => navigate("/guardian/reports?section=hospital_visit");

  return (
    <Card className="cursor-pointer hover:border-primary/20 transition-colors" onClick={openKit}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <BriefcaseMedical className="w-5 h-5 text-primary shrink-0" />
          <span className="text-sm font-semibold flex-1">Hospital Admission Kit</span>
          <Badge variant={count === TOTAL_SLOTS ? "default" : "outline"} className="text-[10px]">
            {loading ? "…" : `${count}/${TOTAL_SLOTS} ready`}
          </Badge>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
        {!loading && count === 0 && (
          <p className="text-[11px] text-muted-foreground">
            Ask {wardName} to upload Aadhaar, PAN, Insurance & Photo in My Profile.
          </p>
        )}
        {!loading && count > 0 && count < TOTAL_SLOTS && (
          <p className="text-[11px] text-muted-foreground">
            Missing: {missing.map(k => SLOT_LABELS[k]).join(", ")}
          </p>
        )}
        {!loading && missing.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="w-full h-8"
            disabled={nudging}
            onClick={handleNudge}
          >
            {nudging ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Bell className="w-3 h-3 mr-1" />}
            Nudge {wardName} for missing docs
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default HospitalKitCard;

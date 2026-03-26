import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import ReportShareButtons from "@/components/ReportShareButtons";

const DoctorVisitReport = () => {
  const { session } = useAuth();
  const [report, setReport] = useState("");
  const [loading, setLoading] = useState(false);

  const generateReport = async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      const [profileRes, medsRes, activityRes, wellnessRes, faceRes] = await Promise.all([
        supabase.from("health_profile").select("*").eq("user_id", session.user.id).maybeSingle(),
        supabase.from("medications").select("name, dosage, frequency, schedule_times").eq("user_id", session.user.id),
        supabase.from("activity_logs").select("*").eq("user_id", session.user.id).order("log_date", { ascending: false }).limit(7),
        supabase.from("wellness_logs").select("*").eq("user_id", session.user.id).order("log_date", { ascending: false }).limit(7),
        supabase.from("face_scans").select("*").eq("user_id", session.user.id).order("scanned_at", { ascending: false }).limit(5),
      ]);

      const payload = {
        profile: profileRes.data,
        medications: medsRes.data || [],
        activity: activityRes.data || [],
        wellness: wellnessRes.data || [],
        faceScans: faceRes.data || [],
      };

      const { data, error } = await supabase.functions.invoke("health-tools", {
        body: { type: "doctor_report", payload: JSON.stringify(payload) },
      });

      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      setReport(data.response);
    } catch (err: any) {
      toast.error("Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 text-center space-y-3">
          <FileText className="w-12 h-12 text-primary mx-auto" />
          <h3 className="font-semibold">Doctor Visit Report</h3>
          <p className="text-sm text-muted-foreground">
            Generate a comprehensive health summary to share with your doctor, including medications, vitals, activity, and wellness trends.
          </p>
          <Button onClick={generateReport} disabled={loading} className="w-full">
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</> : "Generate Report"}
          </Button>
        </CardContent>
      </Card>

      {report && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <ReportShareButtons
              title="Doctor Visit Report"
              subtitle="Comprehensive Health Summary"
              content={report}
              category="Health Report"
            />
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{report}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DoctorVisitReport;

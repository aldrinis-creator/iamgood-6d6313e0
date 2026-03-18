import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Share2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

const DoctorVisitReport = () => {
  const { session } = useAuth();
  const [report, setReport] = useState("");
  const [loading, setLoading] = useState(false);

  const generateReport = async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      // Fetch user health data
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

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: "Doctor Visit Report", text: report });
    } else {
      await navigator.clipboard.writeText(report);
      toast.success("Report copied to clipboard");
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
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleShare}>
                <Share2 className="w-3 h-3 mr-1" /> Share
              </Button>
              <Button size="sm" variant="outline" onClick={() => {
                const blob = new Blob([report], { type: "text/plain" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "doctor-visit-report.txt";
                a.click();
              }}>
                <Download className="w-3 h-3 mr-1" /> Download
              </Button>
            </div>
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

import { useEffect } from "react";
import SeoMeta from "@/components/SeoMeta";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { PRIVACY_POLICY_PDF_URL, GRIEVANCE_OFFICER as G } from "@/lib/legal";

const PrivacyPolicy = () => {
  useEffect(() => {
    window.location.replace(PRIVACY_POLICY_PDF_URL);
  }, []);

  return (
    <>
      <SeoMeta
        title="Privacy Policy"
        description="Check-iN Privacy Policy — DPDP Act 2023 and GDPR compliant. How we protect your health data, medical vault records, location and guardian alerts."
        canonicalPath="/privacy-policy"
      />
      <AppLayout>
        <div className="px-4 py-10 text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">
            Opening the latest Privacy Policy (PDF)…
          </p>
          <Button asChild>
            <a href={PRIVACY_POLICY_PDF_URL} target="_blank" rel="noopener noreferrer">
              <Download className="w-4 h-4 mr-2" />
              Download Privacy Policy (PDF)
            </a>
          </Button>
          <div className="mt-6 rounded-xl border border-border bg-card p-4 text-left text-sm space-y-1">
            <p className="font-semibold text-foreground">Grievance Redressal Officer</p>
            <p className="text-foreground">{G.name}, {G.organisation}</p>
            <a href={`mailto:${G.email}`} className="text-primary underline">{G.email}</a>
            <p className="text-muted-foreground">Complaints are resolved within 30 days.</p>
          </div>
        </div>
      </AppLayout>
    </>
  );
};

export default PrivacyPolicy;

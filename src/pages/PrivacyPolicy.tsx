import { useEffect } from "react";
import SeoMeta from "@/components/SeoMeta";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { PRIVACY_POLICY_PDF_URL } from "@/lib/legal";

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
        </div>
      </AppLayout>
    </>
  );
};

export default PrivacyPolicy;

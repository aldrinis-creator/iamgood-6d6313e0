import { Button } from "@/components/ui/button";
import { Printer, MessageCircle, Mail } from "lucide-react";
import { printReport, shareViaWhatsApp, shareViaEmail } from "@/lib/reportPdf";

interface ReportShareButtonsProps {
  title: string;
  subtitle?: string;
  content: string;
  category?: string;
  date?: string;
}

const ReportShareButtons = ({ title, subtitle, content, category, date }: ReportShareButtonsProps) => {
  const opts = { title, subtitle, content, category, date };

  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => printReport(opts)}>
        <Printer className="w-3.5 h-3.5" /> PDF / Print
      </Button>
      <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-success border-success/30 hover:bg-success/10" onClick={() => shareViaWhatsApp(opts)}>
        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
      </Button>
      <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => shareViaEmail(opts)}>
        <Mail className="w-3.5 h-3.5" /> Email
      </Button>
    </div>
  );
};

export default ReportShareButtons;

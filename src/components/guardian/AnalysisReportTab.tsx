import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { buildLetterheadHtml, markdownToHtml } from "@/lib/reportPdf";

export default function AnalysisReportTab({ wardUserId, wardName }: { wardUserId: string; wardName: string }) {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase
      .from("medical_records")
      .select("*")
      .eq("user_id", wardUserId)
      .or("title.ilike.%Analysis%,record_type.eq.Doctor's Diagnosis")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setReports(data || []);
        setLoading(false);
      });
  }, [wardUserId]);

  const toggleExpand = async (report: any) => {
    if (expandedId === report.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(report.id);
    if (report.file_url && !fileUrls[report.id]) {
      const { data } = await supabase.storage.from("medical-documents").createSignedUrl(report.file_url, 3600);
      if (data?.signedUrl) {
        setFileUrls(prev => ({ ...prev, [report.id]: data.signedUrl }));
      }
    }
  };

  const handlePrint = (report: any, docUrl: string | undefined) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let bodyContent = markdownToHtml(report.description || "");

    if (docUrl && !docUrl.includes('.pdf')) {
      bodyContent += `
        <h3 style="margin-top: 24px; border-bottom: 1px solid #ccc; padding-bottom: 8px;">Original Document:</h3>
        <img src="${docUrl}" style="max-width: 100%; border: 1px solid #eee; margin-top: 12px; page-break-inside: avoid;" onload="setTimeout(() => window.print(), 500)" />
      `;
    }

    const html = buildLetterheadHtml({
      title: report.title,
      subtitle: `For: ${wardName} | Type: ${report.record_type}`,
      bodyHtml: bodyContent,
      actionBarHtml: `
        <div class="no-print" style="margin-bottom: 20px; text-align: center; padding: 20px;">
          <button onclick="window.print()" style="padding: 10px 20px; background: #000; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">Print to PDF</button>
        </div>
      `,
      includeDisclaimer: true
    });

    printWindow.document.write(html);
    printWindow.document.close();

    if (!docUrl || docUrl.includes('.pdf')) {
      setTimeout(() => printWindow.print(), 500);
    }
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  if (reports.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground text-sm">
          No analysis reports found for {wardName}.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {reports.map(report => {
        const isExpanded = expandedId === report.id;
        const docUrl = fileUrls[report.id];
        
        return (
          <Card key={report.id} className="overflow-hidden">
            <div 
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => toggleExpand(report)}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-full text-primary">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{report.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {new Date(report.created_at).toLocaleDateString("en-IN")}  {report.record_type}
                  </p>
                </div>
              </div>
              {isExpanded && (
                <Button variant="outline" size="sm" className="gap-2" onClick={(e) => { e.stopPropagation(); handlePrint(report, docUrl); }}>
                  <Printer className="w-4 h-4" /> Print PDF
                </Button>
              )}
            </div>
            
            {isExpanded && (
              <div className="px-4 pb-4 border-t border-border pt-4 bg-muted/20">
                <div className="prose prose-sm dark:prose-invert max-w-none text-xs">
                  <ReactMarkdown>{report.description}</ReactMarkdown>
                </div>
                
                {report.file_url && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <h4 className="text-xs font-semibold mb-2 flex items-center gap-1">
                      <ImageIcon className="w-4 h-4" /> Original Document
                    </h4>
                    {docUrl ? (
                      docUrl.includes('.pdf') ? (
                        <a href={docUrl} target="_blank" rel="noreferrer" className="text-primary text-xs hover:underline flex items-center gap-1">
                          <FileText className="w-3 h-3" /> View PDF Document
                        </a>
                      ) : (
                        <img src={docUrl} alt="Original document" className="max-h-[300px] object-contain rounded border border-border" />
                      )
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="w-3 h-3 animate-spin" /> Loading document...
                      </div>
                    )}
                  </div>
                )}
                {!report.file_url && (
                  <p className="text-[10px] text-muted-foreground mt-4 pt-4 border-t border-border italic">
                    Note: The original document was not saved for this older report.
                  </p>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

import { Heart, Droplet, Activity, Pill, Zap, Sparkles, Droplets, Stethoscope, CheckCircle2, XCircle, ArrowRight, AlertTriangle, ShieldCheck, ShieldAlert, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import ReactMarkdown from "react-markdown";

/* ── Types ── */
export interface HealthCategory {
  name: string;
  status: "ideal" | "monitoring" | "at_risk";
  score: number;
  findings: string[];
  tests_found: string[];
  tests_missing: string[];
}

export interface VisualReport {
  categories: HealthCategory[];
  next_steps: string[];
  summary: string;
}

/* ── Helpers ── */
const iconMap: Record<string, React.ElementType> = {
  heart: Heart,
  blood: Droplets,
  glucose: Droplet,
  kidney: Activity,
  liver: Pill,
  bone: Activity,
  vitamin: Pill,
  hormone: Zap,
  skin: Sparkles,
  thyroid: Zap,
  cholesterol: Droplet,
  iron: Droplets,
};

function getCategoryIcon(name: string) {
  const lower = name.toLowerCase();
  for (const [key, Icon] of Object.entries(iconMap)) {
    if (lower.includes(key)) return Icon;
  }
  return Stethoscope;
}

const statusConfig = {
  ideal: { label: "IDEAL HEALTH", bg: "bg-success/10", border: "border-success/40", text: "text-success", barColor: "bg-success", icon: ShieldCheck },
  monitoring: { label: "NEEDS MONITORING", bg: "bg-warning/10", border: "border-warning/40", text: "text-warning", barColor: "bg-warning", icon: Shield },
  at_risk: { label: "AT RISK", bg: "bg-destructive/10", border: "border-destructive/40", text: "text-destructive", barColor: "bg-destructive", icon: ShieldAlert },
};

export function tryParseVisualReport(raw: string): VisualReport | null {
  try {
    // Strip markdown code fences if present
    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    }
    const parsed = JSON.parse(cleaned);
    if (parsed?.categories && Array.isArray(parsed.categories) && parsed.categories.length > 0) {
      return parsed as VisualReport;
    }
  } catch {
    // not JSON
  }
  return null;
}

/* ── Component ── */
const VisualHealthReport = ({ report }: { report: VisualReport }) => {
  const idealCount = report.categories.filter(c => c.status === "ideal").length;
  const monitoringCount = report.categories.filter(c => c.status === "monitoring").length;
  const atRiskCount = report.categories.filter(c => c.status === "at_risk").length;

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <Card className="overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-success via-warning to-destructive" />
        <CardContent className="p-4 space-y-3">
          <h3 className="font-bold text-base">Health Analysis</h3>
          <p className="text-sm text-muted-foreground">{report.summary}</p>
          <div className="flex gap-2 flex-wrap">
            {idealCount > 0 && (
              <Badge variant="outline" className="border-success/40 text-success bg-success/10 gap-1">
                <ShieldCheck className="w-3 h-3" /> {idealCount} Ideal
              </Badge>
            )}
            {monitoringCount > 0 && (
              <Badge variant="outline" className="border-warning/40 text-warning bg-warning/10 gap-1">
                <Shield className="w-3 h-3" /> {monitoringCount} Monitoring
              </Badge>
            )}
            {atRiskCount > 0 && (
              <Badge variant="outline" className="border-destructive/40 text-destructive bg-destructive/10 gap-1">
                <ShieldAlert className="w-3 h-3" /> {atRiskCount} At Risk
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Category cards */}
      {report.categories.map((cat, i) => {
        const config = statusConfig[cat.status];
        const Icon = getCategoryIcon(cat.name);
        return (
          <Card key={i} className={`overflow-hidden border ${config.border}`}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-lg ${config.bg} flex items-center justify-center`}>
                    <Icon className={`w-4.5 h-4.5 ${config.text}`} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{cat.name}</p>
                    <Badge variant="outline" className={`text-[9px] mt-0.5 ${config.text} ${config.border} ${config.bg}`}>
                      <config.icon className="w-2.5 h-2.5 mr-0.5" />
                      {config.label}
                    </Badge>
                  </div>
                </div>
                <span className={`text-lg font-bold ${config.text}`}>{cat.score}%</span>
              </div>

              <Progress value={cat.score} className={`h-2 [&>div]:${config.barColor}`} />

              {cat.findings.length > 0 && (
                <ul className="space-y-1">
                  {cat.findings.map((f, fi) => (
                    <li key={fi} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <span className="mt-0.5 shrink-0">•</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              )}

              {(cat.tests_found.length > 0 || cat.tests_missing.length > 0) && (
                <div className="flex flex-wrap gap-1.5">
                  {cat.tests_found.map((t, ti) => (
                    <Badge key={`f-${ti}`} variant="outline" className="text-[9px] gap-0.5 border-success/30 text-success bg-success/5">
                      <CheckCircle2 className="w-2.5 h-2.5" /> {t}
                    </Badge>
                  ))}
                  {cat.tests_missing.map((t, ti) => (
                    <Badge key={`m-${ti}`} variant="outline" className="text-[9px] gap-0.5 border-muted-foreground/30 text-muted-foreground">
                      <XCircle className="w-2.5 h-2.5" /> {t}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Next steps */}
      {report.next_steps.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2.5">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-primary" /> Next Steps
            </h4>
            <ol className="space-y-2">
              {report.next_steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2.5 text-xs">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground">{step}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Disclaimer */}
      <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-[10px] text-muted-foreground">
        <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
        <span>AI-powered analysis for informational purposes only. Not a substitute for professional medical advice. Consult a qualified healthcare provider for diagnosis and treatment.</span>
      </div>
    </div>
  );
};

export default VisualHealthReport;

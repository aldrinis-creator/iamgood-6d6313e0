import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, ChevronDown, ChevronUp, ShieldAlert, Search, WifiOff, Wifi, Printer, Droplet, ChevronRight } from "lucide-react";
import { firstAidGuides, type FirstAidGuide } from "@/data/firstAidGuides";
import { printReport } from "@/lib/reportPdf";

const guideToMarkdown = (g: FirstAidGuide) => {
  const steps = g.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
  const call = g.whenToCall112.map((s) => `- ${s}`).join("\n");
  const dont = g.doNot.map((s) => `- ${s}`).join("\n");
  return `## Steps\n\n${steps}\n\n## When to call 112\n\n${call}\n\n## Do NOT\n\n${dont}`;
};

const EmergencyFirstAid = () => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return firstAidGuides;
    return firstAidGuides.filter(
      (g) => g.title.toLowerCase().includes(q) || g.steps.some((s) => s.toLowerCase().includes(q)),
    );
  }, [query]);

  return (
    <div className="space-y-4">
      {/* Emergency Banner */}
      <Card className="border-destructive/30 bg-destructive/5 sticky top-0 z-10">
        <CardContent className="p-4 flex items-center gap-3">
          <ShieldAlert className="w-8 h-8 text-destructive shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-destructive">Medical Emergency?</p>
            <p className="text-xs text-muted-foreground">Call emergency services immediately</p>
          </div>
          <Button size="sm" className="bg-destructive hover:bg-destructive/90 shrink-0" onClick={() => window.open("tel:112")}>
            <Phone className="w-4 h-4 mr-1" /> 112
          </Button>
        </CardContent>
      </Card>

      {/* Offline indicator + search */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search guides (e.g. choking, burns)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div
          className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium shrink-0 ${
            online ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
          }`}
        >
          {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {online ? "Available offline ✓" : "Cached"}
        </div>
      </div>

      {/* Guides */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-6">No guides match "{query}".</p>
        )}
        {filtered.map((guide) => (
          <Card key={guide.id} className="overflow-hidden">
            <button
              className="w-full p-3 flex items-center gap-3 text-left"
              onClick={() => setExpanded(expanded === guide.id ? null : guide.id)}
            >
              <div className={`w-10 h-10 rounded-full ${guide.color} flex items-center justify-center shrink-0`}>
                <guide.icon className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium flex-1">{guide.title}</span>
              {expanded === guide.id ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
            {expanded === guide.id && (
              <CardContent className="px-4 pb-4 pt-0 space-y-3">
                <ol className="space-y-2">
                  {guide.steps.map((step, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5 font-semibold">
                        {i + 1}
                      </span>
                      <span className="text-muted-foreground">{step}</span>
                    </li>
                  ))}
                </ol>

                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-xs font-semibold text-destructive mb-1.5">When to call 112</p>
                  <ul className="space-y-1">
                    {guide.whenToCall112.map((s, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                        <span className="text-destructive">•</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
                  <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-500 mb-1.5">Do NOT</p>
                  <ul className="space-y-1">
                    {guide.doNot.map((s, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                        <span className="text-yellow-600">•</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1.5"
                    onClick={() =>
                      printReport({
                        title: guide.title,
                        subtitle: "First Aid Guide",
                        category: "Emergency Reference",
                        content: guideToMarkdown(guide),
                        date: new Date().toLocaleDateString("en-IN"),
                      })
                    }
                  >
                    <Printer className="w-3.5 h-3.5" /> Save as PDF
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 gap-1.5 bg-destructive hover:bg-destructive/90"
                    onClick={() => window.open("tel:112")}
                  >
                    <Phone className="w-3.5 h-3.5" /> Call 112
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};

export default EmergencyFirstAid;

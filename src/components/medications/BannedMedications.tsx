import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, AlertTriangle, Loader2, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

const commonBanned = ["Nimesulide", "Furazolidone", "Phenylpropanolamine", "Dextropropoxyphene", "Cisapride", "Phenformin"];

const BannedMedications = () => {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const check = async (name?: string) => {
    const q = name || query;
    if (!q.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("health-tools", {
        body: { type: "banned_check", payload: q },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      try {
        setResult(JSON.parse(data.response));
      } catch {
        setResult({ status: "unknown", details: data.response });
      }
    } catch {
      toast.error("Check failed");
    } finally {
      setLoading(false);
    }
  };

  const statusConfig: Record<string, { emoji: string; bg: string }> = {
    banned: { emoji: "🚫", bg: "border-destructive/30 bg-destructive/5" },
    restricted: { emoji: "⚠️", bg: "border-orange-300 bg-orange-50" },
    warning: { emoji: "⚡", bg: "border-yellow-300 bg-yellow-50" },
    safe: { emoji: "✅", bg: "border-success/30 bg-success/5" },
    unknown: { emoji: "❓", bg: "border-border bg-muted" },
  };

  return (
    <div className="space-y-3">
      <Card className="border-destructive/20 bg-destructive/5">
        <CardContent className="p-3 flex items-start gap-2">
          <ShieldAlert className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Check if a medication is banned or restricted in India by CDSCO. This uses AI and may not be 100% current.
          </p>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Input placeholder="Enter medication name..." value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && check()} />
        <Button size="icon" onClick={() => check()} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </Button>
      </div>

      <div className="flex gap-1 flex-wrap">
        {commonBanned.map((s) => (
          <Button key={s} variant="outline" size="sm" className="text-xs h-7" onClick={() => { setQuery(s); check(s); }}>{s}</Button>
        ))}
      </div>

      {result && (
        <Card className={statusConfig[result.status]?.bg || ""}>
          <CardContent className="p-4 space-y-2">
            <p className="font-semibold text-sm">
              {statusConfig[result.status]?.emoji} Status: {result.status?.toUpperCase()}
            </p>
            <p className="text-sm">{result.details}</p>
            {result.alternatives?.length > 0 && (
              <div>
                <p className="text-xs font-semibold">Alternatives:</p>
                <ul className="text-xs list-disc list-inside">{result.alternatives.map((a: string, i: number) => <li key={i}>{a}</li>)}</ul>
              </div>
            )}
            {result.source && <p className="text-[10px] text-muted-foreground">Source: {result.source}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BannedMedications;

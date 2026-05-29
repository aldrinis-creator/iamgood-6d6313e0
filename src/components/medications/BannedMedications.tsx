import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, ShieldAlert, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { bannedDrugs, bannedSingleSubstances } from "@/data/bannedDrugs";

const commonBanned = ["Nimesulide", "Furazolidone", "Phenylpropanolamine", "Dextropropoxyphene", "Cisapride", "Phenformin"];

const BannedMedications = () => {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showFullList, setShowFullList] = useState(false);
  const [listFilter, setListFilter] = useState("");

  // Local quick-match against the official list
  const localMatch = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.toLowerCase();
    // Check single substances
    if (bannedSingleSubstances.some(s => q.includes(s) || s.includes(q))) {
      return bannedDrugs.find(d => d.name.toLowerCase().includes(q));
    }
    // Check full list
    return bannedDrugs.find(d => d.name.toLowerCase().includes(q));
  }, [query]);

  const filteredList = useMemo(() => {
    if (!listFilter.trim()) return bannedDrugs.slice(0, 50);
    const f = listFilter.toLowerCase();
    return bannedDrugs.filter(d => d.name.toLowerCase().includes(f)).slice(0, 50);
  }, [listFilter]);

  const check = async (name?: string) => {
    const q = name || query;
    if (!q.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("health-tools", {
        body: { type: "banned_check", payload: q },
      });
      if (error) {
        toast.error(`Invoke error: ${error.message || "Unknown"}`);
        return;
      }
      if (data?.error) { 
        toast.error(`API error: ${data.error}`); 
        return; 
      }
      try {
        setResult(JSON.parse(data.response));
      } catch {
        setResult({ status: "unknown", details: data.response });
      }
    } catch (err: any) {
      toast.error(err?.message === "timeout" ? "Scan timed out." : `Scan failed: ${err?.message || "Unknown error"}`);
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
            Official CDSCO banned drugs list (518 entries, updated 22.11.2021). Search locally or use AI for detailed analysis.
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

      {/* Local match indicator */}
      {localMatch && !loading && !result && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-3 space-y-1">
            <p className="text-xs font-semibold text-destructive">🚫 Found in CDSCO Banned List</p>
            <p className="text-xs">{localMatch.name}</p>
            <p className="text-[10px] text-muted-foreground">Ref: {localMatch.notification}</p>
            <p className="text-[10px] text-muted-foreground">Tap Search for detailed AI analysis with alternatives.</p>
          </CardContent>
        </Card>
      )}

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

      {/* Full banned list browser */}
      <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setShowFullList(!showFullList)}>
        {showFullList ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
        Browse Full Banned List ({bannedDrugs.length} drugs)
      </Button>

      {showFullList && (
        <div className="space-y-2">
          <Input placeholder="Filter list..." value={listFilter} onChange={(e) => setListFilter(e.target.value)} className="text-xs" />
          <div className="max-h-64 overflow-y-auto space-y-1">
            {filteredList.map((d) => (
              <div key={d.id} className="flex items-start gap-2 p-2 rounded border border-border text-xs">
                <span className="text-destructive font-mono shrink-0">{d.id}.</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{d.name}</p>
                  <p className="text-[10px] text-muted-foreground">{d.notification}</p>
                </div>
              </div>
            ))}
            {filteredList.length === 50 && !listFilter && (
              <p className="text-[10px] text-muted-foreground text-center">Showing first 50. Use filter to search.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BannedMedications;

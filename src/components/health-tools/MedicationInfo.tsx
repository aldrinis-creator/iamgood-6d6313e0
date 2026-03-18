import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Pill, AlertTriangle, Loader2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

const commonSearches = ["Paracetamol", "Metformin", "Amoxicillin", "Omeprazole", "Cetirizine", "Azithromycin"];

const MedicationInfo = () => {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("");
  const [bannedResult, setBannedResult] = useState("");
  const [bannedQuery, setBannedQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [bannedLoading, setBannedLoading] = useState(false);

  const searchMedication = async (name?: string) => {
    const q = name || query;
    if (!q.trim()) return;
    setLoading(true);
    setResult("");
    try {
      const { data, error } = await supabase.functions.invoke("health-tools", {
        body: { type: "medication_info", payload: q },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      setResult(data.response);
    } catch {
      toast.error("Search failed");
    } finally {
      setLoading(false);
    }
  };

  const checkBanned = async (name?: string) => {
    const q = name || bannedQuery;
    if (!q.trim()) return;
    setBannedLoading(true);
    setBannedResult("");
    try {
      const { data, error } = await supabase.functions.invoke("health-tools", {
        body: { type: "banned_check", payload: q },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      // Parse the JSON response for banned check
      try {
        const parsed = JSON.parse(data.response);
        const statusColors: Record<string, string> = {
          banned: "text-destructive",
          restricted: "text-orange-500",
          warning: "text-yellow-600",
          safe: "text-success",
          unknown: "text-muted-foreground",
        };
        setBannedResult(JSON.stringify(parsed));
      } catch {
        setBannedResult(data.response);
      }
    } catch {
      toast.error("Check failed");
    } finally {
      setBannedLoading(false);
    }
  };

  const renderBannedResult = () => {
    if (!bannedResult) return null;
    try {
      const parsed = JSON.parse(bannedResult);
      const statusEmoji: Record<string, string> = { banned: "🚫", restricted: "⚠️", warning: "⚡", safe: "✅", unknown: "❓" };
      const statusColor: Record<string, string> = {
        banned: "bg-destructive/10 border-destructive/30 text-destructive",
        restricted: "bg-orange-100 border-orange-300 text-orange-700",
        warning: "bg-yellow-100 border-yellow-300 text-yellow-700",
        safe: "bg-success/10 border-success/30 text-success",
        unknown: "bg-muted border-border text-muted-foreground",
      };
      return (
        <Card className={`border ${statusColor[parsed.status] || ""}`}>
          <CardContent className="p-4 space-y-2">
            <p className="font-semibold text-sm">{statusEmoji[parsed.status]} Status: {parsed.status.toUpperCase()}</p>
            <p className="text-sm">{parsed.details}</p>
            {parsed.alternatives?.length > 0 && (
              <div>
                <p className="text-xs font-semibold mt-2">Alternatives:</p>
                <ul className="text-xs list-disc list-inside">{parsed.alternatives.map((a: string, i: number) => <li key={i}>{a}</li>)}</ul>
              </div>
            )}
            {parsed.source && <p className="text-[10px] text-muted-foreground">Source: {parsed.source}</p>}
          </CardContent>
        </Card>
      );
    } catch {
      return <Card><CardContent className="p-4"><ReactMarkdown>{bannedResult}</ReactMarkdown></CardContent></Card>;
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-3 flex items-start gap-2">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Drug information is for educational purposes only. Always consult a doctor or pharmacist before taking any medication.
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="search">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="search" className="text-xs gap-1"><Search className="w-3 h-3" /> Drug Search</TabsTrigger>
          <TabsTrigger value="banned" className="text-xs gap-1"><AlertTriangle className="w-3 h-3" /> Banned List</TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Search medication..." value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchMedication()} />
            <Button size="icon" onClick={() => searchMedication()} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>
          <div className="flex gap-1 flex-wrap">
            {commonSearches.map((s) => (
              <Button key={s} variant="outline" size="sm" className="text-xs h-7" onClick={() => { setQuery(s); searchMedication(s); }}>{s}</Button>
            ))}
          </div>
          {result && (
            <Card><CardContent className="p-4 prose prose-sm max-w-none dark:prose-invert"><ReactMarkdown>{result}</ReactMarkdown></CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="banned" className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Check if medication is banned..." value={bannedQuery} onChange={(e) => setBannedQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && checkBanned()} />
            <Button size="icon" onClick={() => checkBanned()} disabled={bannedLoading}>
              {bannedLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>
          <div className="flex gap-1 flex-wrap">
            {["Nimesulide", "Furazolidone", "Phenylpropanolamine", "Dextropropoxyphene"].map((s) => (
              <Button key={s} variant="outline" size="sm" className="text-xs h-7" onClick={() => { setBannedQuery(s); checkBanned(s); }}>{s}</Button>
            ))}
          </div>
          {renderBannedResult()}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MedicationInfo;

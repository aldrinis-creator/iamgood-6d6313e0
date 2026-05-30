import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Search, AlertTriangle, Loader2, Info, Save, Check, ShieldCheck, ChevronDown, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import ReportShareButtons from "@/components/ReportShareButtons";

interface DrugRefs {
  rxnorm: { rxcui: string; name: string } | null;
  fda: Record<string, string> | null;
  sources: { rxnorm_url: string; fda_url: string };
}

const FDA_SECTIONS: { key: string; label: string }[] = [
  { key: "indications_and_usage", label: "Indications & Usage" },
  { key: "dosage_and_administration", label: "Dosage & Administration" },
  { key: "warnings", label: "Warnings" },
  { key: "adverse_reactions", label: "Adverse Reactions" },
  { key: "contraindications", label: "Contraindications" },
];

const formatEffectiveDate = (raw?: string) => {
  if (!raw || raw.length < 8) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
};

const refsToMarkdown = (refs: DrugRefs): string => {
  const parts: string[] = ["\n\n---\n\n## Verified Sources\n"];
  if (refs.rxnorm) parts.push(`**RxNorm:** ${refs.rxnorm.name} (RxCUI ${refs.rxnorm.rxcui})\n`);
  if (refs.fda) {
    if (refs.fda.brand_name) parts.push(`**Brand:** ${refs.fda.brand_name}`);
    if (refs.fda.generic_name) parts.push(`**Generic:** ${refs.fda.generic_name}`);
    if (refs.fda.manufacturer) parts.push(`**Manufacturer:** ${refs.fda.manufacturer}`);
    FDA_SECTIONS.forEach(({ key, label }) => {
      if (refs.fda![key]) parts.push(`\n### ${label} (FDA)\n${refs.fda![key]}`);
    });
    const eff = formatEffectiveDate(refs.fda.effective_time);
    if (eff) parts.push(`\n_FDA label effective: ${eff}_`);
  }
  parts.push(`\n\nSources: openFDA, NLM RxNorm`);
  return parts.join("\n");
};


const commonSearches = ["Paracetamol", "Metformin", "Amoxicillin", "Omeprazole", "Cetirizine", "Azithromycin"];

const MedicationInfo = () => {
  const { session } = useAuth();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("");
  const [bannedResult, setBannedResult] = useState("");
  const [bannedQuery, setBannedQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [bannedLoading, setBannedLoading] = useState(false);
  const [savingSearch, setSavingSearch] = useState(false);
  const [savedSearch, setSavedSearch] = useState(false);
  const [savingBanned, setSavingBanned] = useState(false);
  const [savedBanned, setSavedBanned] = useState(false);

  const searchMedication = async (name?: string) => {
    const q = name || query;
    if (!q.trim()) return;
    setLoading(true);
    setResult("");
    setSavedSearch(false);
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
    setSavedBanned(false);
    try {
      const { data, error } = await supabase.functions.invoke("health-tools", {
        body: { type: "banned_check", payload: q },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      try {
        const parsed = JSON.parse(data.response);
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

  const saveSearchToVault = async () => {
    if (!session?.user?.id) { toast.error("Please log in to save"); return; }
    setSavingSearch(true);
    try {
      const { error } = await supabase.from("medical_records").insert({
        user_id: session.user.id,
        title: `Medication Info — ${query} — ${new Date().toLocaleDateString("en-IN")}`,
        record_type: "AI Analysis",
        description: result.substring(0, 50000),
        record_date: new Date().toISOString().split("T")[0],
      });
      if (error) throw error;
      setSavedSearch(true);
      toast.success("Your Report is saved in the Vault in Reports in the Medication Info tab");
    } catch (err: any) {
      toast.error(`Failed to save: ${err?.message || "Unknown error"}`);
    } finally {
      setSavingSearch(false);
    }
  };

  const saveBannedToVault = async () => {
    if (!session?.user?.id) { toast.error("Please log in to save"); return; }
    setSavingBanned(true);
    try {
      let content = bannedResult;
      try {
        const parsed = JSON.parse(bannedResult);
        content = `**Status:** ${parsed.status}\n\n${parsed.details}\n\n${parsed.alternatives?.length ? `**Alternatives:** ${parsed.alternatives.join(", ")}` : ""}`;
      } catch { /* use raw */ }
      const { error } = await supabase.from("medical_records").insert({
        user_id: session.user.id,
        title: `Banned Check — ${bannedQuery} — ${new Date().toLocaleDateString("en-IN")}`,
        record_type: "AI Analysis",
        description: content.substring(0, 50000),
        record_date: new Date().toISOString().split("T")[0],
      });
      if (error) throw error;
      setSavedBanned(true);
      toast.success("Your Report is saved in the Vault in Reports in the Medication Info tab");
    } catch (err: any) {
      toast.error(`Failed to save: ${err?.message || "Unknown error"}`);
    } finally {
      setSavingBanned(false);
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

  const SaveButton = ({ saving, saved, onClick }: { saving: boolean; saved: boolean; onClick: () => void }) => (
    <Button
      size="sm"
      variant={saved ? "secondary" : "outline"}
      className="w-full gap-1.5"
      onClick={onClick}
      disabled={saving || saved}
    >
      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
      {saving ? "Saving..." : saved ? "Saved to Vault" : "Save to Vault"}
    </Button>
  );

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
            <div className="space-y-2">
              <Card><CardContent className="p-4 prose prose-sm max-w-none dark:prose-invert"><ReactMarkdown>{result}</ReactMarkdown></CardContent></Card>
              <ReportShareButtons
                title="Medication Info Report"
                subtitle={`Drug: ${query}`}
                content={result}
                category="Health Report"
              />
              <SaveButton saving={savingSearch} saved={savedSearch} onClick={saveSearchToVault} />
            </div>
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
          {bannedResult && (
            <div className="space-y-2">
              <ReportShareButtons
                title="Banned Drug Check"
                subtitle={`Drug: ${bannedQuery}`}
                content={bannedResult}
                category="Health Report"
              />
              <SaveButton saving={savingBanned} saved={savedBanned} onClick={saveBannedToVault} />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MedicationInfo;

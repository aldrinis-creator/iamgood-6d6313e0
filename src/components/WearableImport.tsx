import { useState, useRef } from "react";
import { Upload, FileText, Check, AlertTriangle, Watch, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type WearableFormat = "fitbit" | "samsung" | "apple" | "generic";

interface ParsedRow {
  log_date: string;
  steps: number;
  heart_rate: number;
  calories: number;
  distance_km: number;
  sleep_hours: number;
  active_minutes: number;
  spo2: number;
  exercise_minutes: number;
}

const FORMAT_INFO: Record<WearableFormat, { label: string; desc: string; accept: string }> = {
  fitbit: { label: "Fitbit", desc: "Export CSV from Fitbit app → Account → Data Export", accept: ".csv" },
  samsung: { label: "Samsung Health", desc: "Export CSV from Samsung Health → Settings → Download Data", accept: ".csv" },
  apple: { label: "Apple Health", desc: "Export XML from Health app → Profile → Export All Health Data", accept: ".csv,.xml" },
  generic: { label: "Generic CSV/JSON", desc: "Any file with columns: date, steps, heart_rate, calories, etc.", accept: ".csv,.json" },
};

// Column name mappings per format
const COLUMN_MAPS: Record<WearableFormat, Record<string, string>> = {
  fitbit: {
    date: "log_date", steps: "steps", "resting heart rate": "heart_rate",
    "calories burned": "calories", distance: "distance_km",
    "minutes asleep": "sleep_hours", "minutes fairly active": "active_minutes",
    "minutes very active": "active_minutes",
  },
  samsung: {
    "start time": "log_date", "step count": "steps", "heart rate": "heart_rate",
    "calorie": "calories", distance: "distance_km", "sleep duration": "sleep_hours",
    "active time": "active_minutes",
  },
  apple: {
    startdate: "log_date", value: "steps", // simplified — Apple exports are complex
  },
  generic: {
    date: "log_date", log_date: "log_date", steps: "steps", heart_rate: "heart_rate",
    calories: "calories", distance: "distance_km", distance_km: "distance_km",
    sleep_hours: "sleep_hours", sleep: "sleep_hours", active_minutes: "active_minutes",
    spo2: "spo2", exercise_minutes: "exercise_minutes",
  },
};

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());
  return lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ""; });
    return row;
  });
}

function mapRows(raw: Record<string, string>[], fmt: WearableFormat): ParsedRow[] {
  const colMap = COLUMN_MAPS[fmt];
  const results: ParsedRow[] = [];

  for (const row of raw) {
    const mapped: Partial<ParsedRow> = {};
    for (const [srcCol, val] of Object.entries(row)) {
      const target = colMap[srcCol.toLowerCase()];
      if (!target) continue;
      if (target === "log_date") {
        // Try to parse date
        const d = new Date(val);
        if (!isNaN(d.getTime())) mapped.log_date = format(d, "yyyy-MM-dd");
      } else {
        const num = parseFloat(val);
        if (!isNaN(num)) (mapped as any)[target] = (mapped as any)[target] ? (mapped as any)[target] + num : num;
      }
    }
    if (!mapped.log_date) continue;

    results.push({
      log_date: mapped.log_date,
      steps: Math.round(mapped.steps || 0),
      heart_rate: Math.round(mapped.heart_rate || 0),
      calories: Math.round(mapped.calories || 0),
      distance_km: Number((mapped.distance_km || 0).toFixed(2)),
      sleep_hours: Number(((mapped.sleep_hours || 0) > 24 ? (mapped.sleep_hours || 0) / 60 : (mapped.sleep_hours || 0)).toFixed(1)),
      active_minutes: Math.round(mapped.active_minutes || 0),
      spo2: Math.round(mapped.spo2 || 0),
      exercise_minutes: Math.round(mapped.exercise_minutes || 0),
    });
  }

  // Deduplicate by date (sum values)
  const byDate: Record<string, ParsedRow> = {};
  for (const r of results) {
    if (!byDate[r.log_date]) { byDate[r.log_date] = { ...r }; continue; }
    const existing = byDate[r.log_date];
    existing.steps += r.steps;
    existing.calories += r.calories;
    existing.active_minutes += r.active_minutes;
    existing.exercise_minutes += r.exercise_minutes;
    if (r.heart_rate) existing.heart_rate = r.heart_rate; // take latest
    if (r.spo2) existing.spo2 = r.spo2;
    if (r.distance_km) existing.distance_km += r.distance_km;
    if (r.sleep_hours) existing.sleep_hours = r.sleep_hours;
  }

  return Object.values(byDate).sort((a, b) => a.log_date.localeCompare(b.log_date));
}

interface WearableImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}

const WearableImport = ({ open, onOpenChange, onImported }: WearableImportProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [wearableFormat, setWearableFormat] = useState<WearableFormat>("generic");
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState<"select" | "preview">("select");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      let rawRows: Record<string, string>[];

      if (file.name.endsWith(".json")) {
        const json = JSON.parse(text);
        rawRows = Array.isArray(json) ? json : json.data || json.rows || [];
      } else {
        rawRows = parseCSV(text);
      }

      if (rawRows.length === 0) {
        toast({ title: "No Data", description: "Could not parse any rows from the file.", variant: "destructive" });
        return;
      }

      const mapped = mapRows(rawRows, wearableFormat);
      if (mapped.length === 0) {
        toast({ title: "No Matching Data", description: "Could not map any columns. Try 'Generic CSV' format.", variant: "destructive" });
        return;
      }

      setParsedData(mapped);
      setStep("preview");
    } catch (err: any) {
      toast({ title: "Parse Error", description: err.message || "Failed to read file.", variant: "destructive" });
    }
  };

  const handleImport = async () => {
    if (!user || parsedData.length === 0) return;
    setImporting(true);
    try {
      const payload = parsedData.map(r => ({
        user_id: user.id,
        log_date: r.log_date,
        steps: r.steps,
        heart_rate: r.heart_rate,
        calories: r.calories,
        distance_km: r.distance_km,
        sleep_hours: r.sleep_hours,
        active_minutes: r.active_minutes,
        spo2: r.spo2,
        exercise_minutes: r.exercise_minutes,
        source: "import",
        notes: `Imported from ${FORMAT_INFO[wearableFormat].label}`,
      }));

      // Insert in batches of 50
      for (let i = 0; i < payload.length; i += 50) {
        const batch = payload.slice(i, i + 50);
        const { error } = await supabase.from("activity_logs").insert(batch as any);
        if (error) throw error;
      }

      toast({ title: "Import Complete", description: `${parsedData.length} day(s) of wearable data imported.` });
      onImported?.();
      handleClose();
    } catch (err: any) {
      toast({ title: "Import Failed", description: err.message || "Could not save data.", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setParsedData([]);
    setStep("select");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Watch className="w-5 h-5 text-primary" />
            Import Wearable Data
          </DialogTitle>
          <DialogDescription>
            Upload exported data from your wearable device or health app.
          </DialogDescription>
        </DialogHeader>

        {step === "select" && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Wearable / App</label>
              <Select value={wearableFormat} onValueChange={(v) => setWearableFormat(v as WearableFormat)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(FORMAT_INFO).map(([key, info]) => (
                    <SelectItem key={key} value={key}>{info.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1.5">{FORMAT_INFO[wearableFormat].desc}</p>
            </div>

            <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
              <CardContent className="p-6 text-center space-y-3">
                <Upload className="w-8 h-8 mx-auto text-primary" />
                <p className="text-sm font-medium">Upload your export file</p>
                <p className="text-xs text-muted-foreground">CSV or JSON format</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept={FORMAT_INFO[wearableFormat].accept}
                  onChange={handleFile}
                  className="hidden"
                />
                <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2">
                  <FileText className="w-4 h-4" /> Choose File
                </Button>
              </CardContent>
            </Card>

            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <span>Imported data will be added as new entries. Existing data for the same dates won't be overwritten.</span>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 text-sm">
              <Check className="w-4 h-4 text-success" />
              <span className="font-medium">{parsedData.length} day(s) parsed</span>
            </div>

            <ScrollArea className="flex-1 max-h-[300px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Steps</TableHead>
                    <TableHead className="text-xs">HR</TableHead>
                    <TableHead className="text-xs">Cal</TableHead>
                    <TableHead className="text-xs">Dist</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.slice(0, 30).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{r.log_date}</TableCell>
                      <TableCell className="text-xs">{r.steps.toLocaleString()}</TableCell>
                      <TableCell className="text-xs">{r.heart_rate || "—"}</TableCell>
                      <TableCell className="text-xs">{r.calories || "—"}</TableCell>
                      <TableCell className="text-xs">{r.distance_km || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {parsedData.length > 30 && (
                <p className="text-xs text-muted-foreground p-2 text-center">…and {parsedData.length - 30} more rows</p>
              )}
            </ScrollArea>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep("select")}>Back</Button>
              <Button onClick={handleImport} disabled={importing} className="gap-2">
                <Upload className="w-4 h-4" />
                {importing ? "Importing…" : `Import ${parsedData.length} Days`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WearableImport;

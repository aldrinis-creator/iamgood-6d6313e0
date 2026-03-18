import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { BookOpen, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";

const MOODS = [
  { emoji: "😊", label: "Great", value: "great" },
  { emoji: "🙂", label: "Good", value: "good" },
  { emoji: "😐", label: "Okay", value: "okay" },
  { emoji: "😔", label: "Low", value: "low" },
  { emoji: "😣", label: "Bad", value: "bad" },
];

const COMMON_SYMPTOMS = [
  "Headache", "Fatigue", "Nausea", "Dizziness", "Body Ache",
  "Fever", "Cough", "Breathlessness", "Anxiety", "Insomnia",
];

type JournalEntry = {
  id: string;
  entry_date: string;
  mood: string;
  symptoms: string[];
  notes: string | null;
  created_at: string;
};

const CareJournal = () => {
  const { session } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [mood, setMood] = useState("");
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const userId = session?.user?.id;

  const fetchEntries = async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("care_journal")
      .select("*")
      .eq("user_id", userId)
      .order("entry_date", { ascending: false })
      .limit(30);

    if (error) {
      toast.error("Failed to load journal entries");
    } else {
      setEntries(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEntries();
  }, [userId]);

  const toggleSymptom = (symptom: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(symptom) ? prev.filter((s) => s !== symptom) : [...prev, symptom]
    );
  };

  const handleSave = async () => {
    if (!userId || !mood) {
      toast.error("Please select your mood");
      return;
    }
    setSaving(true);

    const { error } = await supabase.from("care_journal").insert({
      user_id: userId,
      mood,
      symptoms: selectedSymptoms,
      notes: notes.trim() || null,
    });

    if (error) {
      toast.error("Failed to save entry");
    } else {
      toast.success("Journal entry saved!");
      setMood("");
      setSelectedSymptoms([]);
      setNotes("");
      setShowForm(false);
      fetchEntries();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("care_journal").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete entry");
    } else {
      setEntries((prev) => prev.filter((e) => e.id !== id));
      toast.success("Entry deleted");
    }
  };

  const getMoodEmoji = (value: string) => MOODS.find((m) => m.value === value)?.emoji || "😐";

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground text-sm">
          Loading journal…
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-success" />
          Care Journal
        </h2>
        <Button size="sm" onClick={() => setShowForm(!showForm)} variant={showForm ? "outline" : "default"}>
          <Plus className="w-4 h-4 mr-1" />
          {showForm ? "Cancel" : "New Entry"}
        </Button>
      </div>

      {/* New Entry Form */}
      {showForm && (
        <Card className="border-success/30">
          <CardContent className="p-4 space-y-4">
            {/* Mood selector */}
            <div>
              <p className="text-sm font-medium mb-2">How are you feeling today?</p>
              <div className="flex gap-2 justify-between">
                {MOODS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setMood(m.value)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all flex-1 ${
                      mood === m.value
                        ? "border-success bg-success/10 shadow-sm"
                        : "border-border hover:border-success/40"
                    }`}
                  >
                    <span className="text-2xl">{m.emoji}</span>
                    <span className="text-[10px] font-medium text-muted-foreground">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Symptoms */}
            <div>
              <p className="text-sm font-medium mb-2">Any symptoms?</p>
              <div className="flex flex-wrap gap-2">
                {COMMON_SYMPTOMS.map((symptom) => (
                  <Badge
                    key={symptom}
                    variant={selectedSymptoms.includes(symptom) ? "default" : "outline"}
                    className="cursor-pointer transition-all"
                    onClick={() => toggleSymptom(symptom)}
                  >
                    {symptom}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <p className="text-sm font-medium mb-2">Notes (optional)</p>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="How was your day? Any observations…"
                maxLength={1000}
                rows={3}
              />
            </div>

            <Button onClick={handleSave} disabled={saving || !mood} className="w-full">
              {saving ? "Saving…" : "Save Entry"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Entries list */}
      {entries.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground text-sm">
            No journal entries yet. Tap "New Entry" to start logging your daily health.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const isExpanded = expandedId === entry.id;
            return (
              <Card key={entry.id} className="overflow-hidden">
                <button
                  className="w-full text-left p-3 flex items-center gap-3"
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                >
                  <span className="text-2xl">{getMoodEmoji(entry.mood)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {format(new Date(entry.entry_date), "EEE, d MMM yyyy")}
                    </p>
                    {entry.symptoms && entry.symptoms.length > 0 && (
                      <p className="text-xs text-muted-foreground truncate">
                        {entry.symptoms.join(", ")}
                      </p>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                </button>
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
                    {entry.symptoms && entry.symptoms.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {entry.symptoms.map((s) => (
                          <Badge key={s} variant="secondary" className="text-xs">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {entry.notes && (
                      <p className="text-sm text-muted-foreground">{entry.notes}</p>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(entry.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CareJournal;

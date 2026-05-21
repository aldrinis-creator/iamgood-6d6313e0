import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Send, Loader2, Stethoscope, Bot, User, Save, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import ReportShareButtons from "@/components/ReportShareButtons";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SymptomChecker = () => {
  const { session } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setSaved(false);

    try {
      // Cap conversation context to the last 6 turns to keep token cost bounded.
      const recent = [...messages, userMsg].slice(-6);
      const history = recent.map((m) => `${m.role}: ${m.content}`).join("\n");
      const { data, error } = await supabase.functions.invoke("health-tools", {
        body: { type: "symptom_check", payload: history },
      });

      // Try to extract the server's error body even on non-2xx responses
      let serverError: string | null = null;
      let status: number | null = null;
      if (error) {
        status = (error as any)?.context?.response?.status ?? null;
        try {
          const body = await (error as any)?.context?.response?.json?.();
          serverError = body?.error ?? null;
        } catch { /* ignore */ }
      }
      if (!serverError && data?.error) serverError = data.error;

      if (serverError || error) {
        let friendly = serverError || "Failed to get response";
        if (status === 402 || /credit/i.test(friendly)) {
          friendly = "AI credits exhausted. Please top up in Workspace → Settings → Usage to continue.";
        } else if (status === 429 || /rate.?limit/i.test(friendly)) {
          friendly = "AI is busy right now. Please try again in a moment.";
        }
        toast.error(friendly);
        setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ I couldn't respond: ${friendly}` }]);
        return;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
    } catch (e: any) {
      const msg = e?.message || "Failed to get response";
      toast.error(msg);
      setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ I couldn't respond: ${msg}` }]);
    } finally {
      setLoading(false);
    }
  };

  const chatAsMarkdown = () =>
    messages.map((m) => `**${m.role === "user" ? "You" : "AI"}:** ${m.content}`).join("\n\n---\n\n");

  const hasAssistantMessage = messages.some((m) => m.role === "assistant");

  const saveToVault = async () => {
    if (!session?.user?.id) { toast.error("Please log in to save"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("medical_records").insert({
        user_id: session.user.id,
        title: `Symptom Check — ${new Date().toLocaleDateString("en-IN")}`,
        record_type: "AI Analysis",
        description: chatAsMarkdown().substring(0, 50000),
        record_date: new Date().toISOString().split("T")[0],
      });
      if (error) throw error;
      setSaved(true);
      toast.success("Your Report is saved in the Vault in Reports in the Symptom Checker tab");
    } catch (err: any) {
      toast.error(`Failed to save: ${err?.message || "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Warning Banner */}
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="p-3 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-destructive">Emergency Symptoms?</p>
            <p className="text-xs text-muted-foreground">
              Chest pain, difficulty breathing, severe bleeding, or loss of consciousness — call <strong>112</strong> immediately.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Chat Area */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-3">
            <Stethoscope className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-semibold">AI Symptom Checker</h3>
          </div>

          <div className="min-h-[300px] max-h-[400px] overflow-y-auto space-y-3 mb-3">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <Bot className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Describe your symptoms and I'll help assess them.</p>
                <div className="flex flex-wrap gap-1 justify-center mt-3">
                  {["Headache and fever", "Stomach pain", "Skin rash", "Joint pain"].map((s) => (
                    <Button key={s} variant="outline" size="sm" className="text-xs" onClick={() => setInput(s)}>{s}</Button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && <Bot className="w-6 h-6 text-primary shrink-0 mt-1" />}
                <div className={`max-w-[85%] rounded-lg p-3 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : msg.content}
                </div>
                {msg.role === "user" && <User className="w-6 h-6 text-muted-foreground shrink-0 mt-1" />}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2">
                <Bot className="w-6 h-6 text-primary shrink-0" />
                <div className="bg-muted rounded-lg p-3"><Loader2 className="w-4 h-4 animate-spin" /></div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Describe your symptoms..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
            />
            <Button size="icon" onClick={send} disabled={loading || !input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Share & Save */}
      {hasAssistantMessage && (
        <Card>
          <CardContent className="p-3 space-y-2">
            <ReportShareButtons
              title="Symptom Check Report"
              subtitle="AI Symptom Assessment"
              content={chatAsMarkdown()}
              category="Health Report"
            />
            <Button
              size="sm"
              variant={saved ? "secondary" : "outline"}
              className="w-full gap-1.5"
              onClick={saveToVault}
              disabled={saving || saved}
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? "Saving..." : saved ? "Saved to Vault" : "Save to Vault"}
            </Button>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground text-center">
        ⚠️ This is not a medical diagnosis. Always consult a qualified healthcare professional.
      </p>
    </div>
  );
};

export default SymptomChecker;

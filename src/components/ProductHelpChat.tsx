import { useState, useRef, useEffect } from "react";
import { MessageCircleQuestion, Send, X, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "How do I add a guardian?",
  "What's in the Pro plan?",
  "How does SOS work?",
  "How do I use the medical vault?",
];

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/product-assistant`;
const APIKEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export default function ProductHelpChat() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  // Hide on admin routes
  if (pathname.startsWith("/admin")) return null;

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const resp = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(APIKEY ? { Authorization: `Bearer ${APIKEY}`, apikey: APIKEY } : {}),
        },
        body: JSON.stringify({ messages: next }),
      });
      const data = await resp.json().catch(() => ({}));
      const answer = data?.answer || data?.error || "Sorry, I couldn't answer that. Please try again.";
      setMessages((m) => [...m, { role: "assistant", content: answer }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "I couldn't reach the help assistant. Please check your connection and try again." }]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Ask Check-iN help assistant"
          className="fixed bottom-4 right-4 z-40 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        >
          <MessageCircleQuestion className="h-6 w-6" />
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md h-[80vh] sm:h-[70vh] sm:rounded-2xl rounded-t-2xl bg-background border border-border shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary text-primary-foreground">
              <div className="flex items-center gap-2">
                <MessageCircleQuestion className="h-5 w-5" />
                <div>
                  <div className="font-semibold text-sm">Ask Check-iN</div>
                  <div className="text-[11px] opacity-80">Help with features & how-to</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="p-1 rounded hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
              {messages.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Hi! Ask me anything about Check-iN — features, plans, guardian setup, medications, vault, and more.
                </p>
              )}



              {messages.map((m, i) => (
                <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    )}
                  >
                    {m.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <span className="whitespace-pre-wrap">{m.content}</span>
                    )}
                  </div>
                </div>
              ))}

              {busy && (
                <div className="flex justify-start">
                  <div className="bg-muted text-muted-foreground rounded-2xl rounded-bl-sm px-3 py-2 text-sm flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Thinking…
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 overflow-x-auto px-3 py-2 border-t border-border bg-muted/30">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={busy}
                  className="shrink-0 whitespace-nowrap text-xs px-3 py-1.5 rounded-full border border-border bg-background hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); send(input); }}
              className="flex items-center gap-2 p-3 border-t border-border bg-background"
            >
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about Check-iN…"
                disabled={busy}
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label="Send">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

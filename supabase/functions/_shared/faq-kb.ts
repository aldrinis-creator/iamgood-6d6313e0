// Renders FAQ sections into markdown text, and provides a lightweight
// keyword-based retriever so the help assistant can inline only the most
// relevant Q&A pairs (instead of stuffing the entire FAQ corpus into every
// prompt).
import { faqSections } from "./faq-user.ts";
import { guardianFaqSections } from "./faq-guardian.ts";

export type Audience = "user" | "guardian" | "any";

interface Entry {
  audience: "user" | "guardian";
  section: string;
  question: string;
  answer: string;
  haystack: string; // lowercased searchable text
}

const STOPWORDS = new Set([
  "a","an","and","are","as","at","be","by","can","do","does","for","from","how",
  "i","if","in","is","it","its","me","my","of","on","or","so","the","to","was",
  "what","when","where","which","who","why","will","with","you","your","this",
  "that","there","then","them","they","have","has","had","not","but","about",
  "into","been","were","would","could","should","may","might","just","also",
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function buildEntries(): Entry[] {
  const out: Entry[] = [];
  for (const s of faqSections) {
    for (const it of s.items) {
      out.push({
        audience: "user",
        section: s.title,
        question: it.question,
        answer: it.answer,
        haystack: `${s.title} ${it.question} ${it.answer}`.toLowerCase(),
      });
    }
  }
  for (const s of guardianFaqSections) {
    for (const it of s.items) {
      out.push({
        audience: "guardian",
        section: s.title,
        question: it.question,
        answer: it.answer,
        haystack: `${s.title} ${it.question} ${it.answer}`.toLowerCase(),
      });
    }
  }
  return out;
}

const ENTRIES = buildEntries();

/**
 * Returns markdown text for the top-N FAQ entries matching the query,
 * scored by keyword overlap. Guardian entries are up-weighted when the
 * caller identifies as a guardian, user entries when they identify as a user.
 */
export function selectRelevantFaqs(query: string, audience: Audience = "any", limit = 10): string {
  const tokens = tokenize(query);
  if (tokens.length === 0) return "";

  const scored = ENTRIES.map((e) => {
    let score = 0;
    for (const t of tokens) {
      if (e.haystack.includes(t)) score += 1;
      // question hits are worth more than answer hits
      if (e.question.toLowerCase().includes(t)) score += 1;
    }
    if (audience !== "any" && e.audience === audience) score *= 1.5;
    else if (audience !== "any" && e.audience !== audience) score *= 0.6;
    return { e, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (scored.length === 0) return "";

  const byAudience: Record<string, string[]> = { user: [], guardian: [] };
  for (const { e } of scored) {
    byAudience[e.audience].push(`### Q: ${e.question}\nA: ${e.answer}`);
  }

  const parts: string[] = [];
  if (byAudience.user.length) parts.push(`## User FAQs (matched)\n${byAudience.user.join("\n\n")}`);
  if (byAudience.guardian.length) parts.push(`## Guardian FAQs (matched)\n${byAudience.guardian.join("\n\n")}`);
  return parts.join("\n\n");
}

export function totalFaqCount() {
  return ENTRIES.length;
}

// Shared helper: convert an AI Gateway (Lovable) non-OK fetch response into
// a standardized `{ status, code, error, message }` payload so the client
// can render a friendly message and distinguish workspace-level blocks
// from transient failures.

export type AiGatewayCode =
  | "credits_exhausted"
  | "credit_limit_reached"
  | "rate_limited"
  | "ai_error";

export interface AiGatewayError {
  status: number; // HTTP status to return to the client
  code: AiGatewayCode;
  error: string; // short machine-ish label
  message: string; // human friendly message
}

const MESSAGES: Record<AiGatewayCode, string> = {
  credits_exhausted:
    "AI analysis is temporarily unavailable — workspace credits exhausted. Please contact your admin.",
  credit_limit_reached:
    "AI analysis is paused — workspace credit limit reached. An admin can raise the limit in workspace settings.",
  rate_limited: "Too many requests right now. Please try again in a minute.",
  ai_error: "AI service unavailable. Please try again shortly.",
};

/**
 * Classify a Lovable AI Gateway failure. Pass the upstream `Response` (already
 * checked as !ok) and the raw text body. The upstream may return 403 with a
 * `credit_limit_reached` body — surface that as an actionable 402-family
 * error to the client (using status 402) rather than a generic 500.
 */
export function classifyAiGatewayFailure(status: number, bodyText: string): AiGatewayError {
  if (status === 402) {
    return { status: 402, code: "credits_exhausted", error: "credits_exhausted", message: MESSAGES.credits_exhausted };
  }
  if (status === 403 && /credit_limit_reached/i.test(bodyText)) {
    return { status: 402, code: "credit_limit_reached", error: "credit_limit_reached", message: MESSAGES.credit_limit_reached };
  }
  if (status === 429) {
    return { status: 429, code: "rate_limited", error: "rate_limited", message: MESSAGES.rate_limited };
  }
  return { status: 502, code: "ai_error", error: "ai_error", message: MESSAGES.ai_error };
}

import { toast } from "sonner";

export type AiErrorCode =
  | "credits_exhausted"
  | "credit_limit_reached"
  | "rate_limited"
  | "ai_error"
  | "unknown";

export interface AiErrorInfo {
  status: number;
  code: AiErrorCode;
  message: string;
}

const MESSAGES: Record<AiErrorCode, string> = {
  credits_exhausted:
    "AI analysis is temporarily unavailable — workspace credits exhausted. Please contact your admin.",
  credit_limit_reached:
    "AI analysis is paused — workspace credit limit reached. An admin can raise the limit in workspace settings.",
  rate_limited: "Too many requests right now. Please try again in a minute.",
  ai_error: "AI service unavailable. Please try again shortly.",
  unknown: "Something went wrong. Please try again.",
};

function codeFromStatusAndBody(status: number, body?: unknown): AiErrorCode {
  const text = typeof body === "string" ? body : body ? JSON.stringify(body) : "";
  if (status === 402) return "credits_exhausted";
  if (status === 403 && /credit_limit_reached/i.test(text)) return "credit_limit_reached";
  if (status === 429) return "rate_limited";
  if (status >= 400) return "ai_error";
  return "unknown";
}

/**
 * Parse a supabase.functions.invoke error (FunctionsHttpError) or a raw
 * response-shaped object into a friendly AiErrorInfo.
 */
export async function parseAiError(err: unknown): Promise<AiErrorInfo> {
  try {
    // supabase-js FunctionsHttpError shape: err.context.response
    const anyErr = err as any;
    const resp: Response | undefined = anyErr?.context?.response;
    if (resp && typeof resp.status === "number") {
      let body: unknown = undefined;
      try {
        body = await resp.clone().json();
      } catch {
        try {
          body = await resp.clone().text();
        } catch {
          /* ignore */
        }
      }
      // Server may already send a `code`
      const serverCode = (body as any)?.code as AiErrorCode | undefined;
      const code = serverCode ?? codeFromStatusAndBody(resp.status, body);
      return { status: resp.status, code, message: MESSAGES[code] };
    }
    // Plain object with status/code
    if (anyErr && typeof anyErr.status === "number") {
      const code =
        (anyErr.code as AiErrorCode | undefined) ??
        codeFromStatusAndBody(anyErr.status, anyErr.body ?? anyErr.message);
      return { status: anyErr.status, code, message: MESSAGES[code] };
    }
  } catch {
    /* fallthrough */
  }
  return { status: 0, code: "unknown", message: MESSAGES.unknown };
}

/** Show a friendly toast for an AI-invoke error. Returns the parsed info. */
export async function toastAiError(err: unknown, fallback?: string): Promise<AiErrorInfo> {
  const info = await parseAiError(err);
  toast.error(info.code === "unknown" && fallback ? fallback : info.message);
  return info;
}

/** Inspect a data payload returned from an edge fn for embedded gateway errors. */
export function aiErrorFromData(data: unknown): AiErrorInfo | null {
  const d = data as any;
  if (!d || typeof d !== "object") return null;
  if (d.code && MESSAGES[d.code as AiErrorCode]) {
    return {
      status: typeof d.status === "number" ? d.status : 0,
      code: d.code,
      message: MESSAGES[d.code as AiErrorCode],
    };
  }
  return null;
}

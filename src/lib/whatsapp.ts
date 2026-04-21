/**
 * Normalize a phone number to international WhatsApp format (digits only, no '+').
 * Defaults 10-digit numbers to India (+91).
 *
 *   "+91 98765 43210"  -> "919876543210"
 *   "9876543210"       -> "919876543210"
 *   "09876543210"      -> "919876543210"
 *   "00919876543210"   -> "919876543210"
 *   "919876543210"     -> "919876543210"
 */
export function normalizeWhatsAppNumber(raw: string): string {
  let digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";

  // Strip leading '00' international prefix
  if (digits.startsWith("00")) digits = digits.slice(2);
  // Strip leading '0' trunk prefix on 11-digit numbers (e.g. 09876543210)
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  // Default 10-digit local numbers to India
  if (digits.length === 10) digits = "91" + digits;

  return digits;
}

/**
 * Build a working WhatsApp composer URL using api.whatsapp.com (works on
 * desktop + mobile and avoids the wa.me 404 some numbers/regions hit).
 */
export function buildWhatsAppUrl(rawPhone: string, message: string): string {
  const phone = normalizeWhatsAppNumber(rawPhone);
  return `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
}

/**
 * Tiny self-contained "Preparing WhatsApp..." HTML for the synchronous popup
 * that we open before awaiting MSG91. If MSG91 succeeds we close it; if it
 * fails we navigate it to the WhatsApp composer URL.
 */
export const PREPARING_WHATSAPP_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>Preparing WhatsApp…</title><style>
body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f6f7f9;color:#1f2937}
.box{text-align:center;padding:24px}
.spinner{width:36px;height:36px;border:3px solid #e5e7eb;border-top-color:#16a34a;border-radius:50%;margin:0 auto 16px;animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
</style></head><body><div class="box"><div class="spinner"></div><div>Preparing WhatsApp order…</div></div></body></html>`;

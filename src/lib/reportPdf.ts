/**
 * Shared utility for generating printable PDF reports with Check-iN branded letterhead.
 * Uses browser print-to-PDF approach with styled HTML.
 */

const APP_NAME = "CHECK-iN";
const TAGLINE = "Personal Safety & Emergency Monitoring System";

// Check-iN logo as base64 data URI
const CHECKIN_LOGO_B64 = "data:image/jpeg;base64,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";

interface ReportOptions {
  title: string;
  subtitle?: string;
  content: string; // markdown or plain text
  date?: string;
  category?: string;
}

/** Convert basic markdown to HTML (headings, bold, italic, lists, paragraphs) */
function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3 style="color:#1a365d;margin:16px 0 8px;font-size:15px;">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="color:#1a365d;margin:18px 0 8px;font-size:17px;">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="color:#1a365d;margin:20px 0 10px;font-size:20px;">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^[•\-]\s+(.+)$/gm, '<li style="margin:2px 0;font-size:13px;">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, (match) => `<ul style="margin:8px 0 8px 16px;padding:0;">${match}</ul>`)
    .replace(/^(?!<[hul])(.*\S.*)$/gm, '<p style="margin:6px 0;font-size:13px;line-height:1.6;">$1</p>')
    .replace(/⚠️/g, "⚠")
    .replace(/\n{2,}/g, "");
}

/** Build the letterhead header HTML */
function buildLetterheadHeader(): string {
  return `
  <div class="letterhead-header">
    <div class="letterhead-left">
      <img src="${CHECKIN_LOGO_B64}" alt="Check-iN" class="checkin-logo" />
      <div class="brand-text">
        <div class="brand-name">${APP_NAME}</div>
        <div class="brand-tagline">${TAGLINE}</div>
      </div>
    </div>
    <div class="letterhead-right">
      <div class="fw-brand">
        <span class="fw-name">FUTURE WAVE</span>
        <span class="fw-sub">Technologies</span>
      </div>
    </div>
  </div>
  <div class="red-divider"></div>`;
}

/** Build the letterhead footer HTML */
function buildLetterheadFooter(): string {
  return `
  <div class="letterhead-footer">
    <div class="red-divider-thin"></div>
    <div class="footer-content">
      <div class="footer-left">Check-iN | PERS</div>
      <div class="footer-center">
        www.futurewave.in | sales@futurewave.in | +91 7045868482
      </div>
      <div class="footer-right">Confidential</div>
    </div>
  </div>`;
}

/** Shared letterhead CSS */
function getLetterheadCss(): string {
  return `
    @media print {
      body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #1a202c; margin: 0; padding: 0; background: #fff; }
    
    /* Letterhead Header */
    .letterhead-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 24px 32px 16px;
    }
    .letterhead-left { display: flex; align-items: center; gap: 12px; }
    .checkin-logo { width: 48px; height: 48px; border-radius: 10px; }
    .brand-text { display: flex; flex-direction: column; }
    .brand-name { font-size: 18px; font-weight: 800; color: #1a202c; letter-spacing: 0.5px; }
    .brand-tagline { font-size: 11px; color: #6b7280; }
    .letterhead-right { text-align: right; }
    .fw-brand { display: flex; flex-direction: column; align-items: flex-end; }
    .fw-name { font-size: 16px; font-weight: 700; color: #4a4a4a; letter-spacing: 1px; }
    .fw-sub { font-size: 11px; color: #9ca3af; }
    
    /* Red Divider */
    .red-divider { height: 3px; background: #dc2626; margin: 0 32px; }
    .red-divider-thin { height: 2px; background: #dc2626; margin: 0; }
    
    /* Title Block */
    .title-block { padding: 20px 32px 12px; border-left: 4px solid #e5e7eb; margin: 16px 32px 0; }
    .title-block h1 { font-size: 22px; font-weight: 800; color: #1a202c; margin: 0 0 4px; }
    .title-block .subtitle { font-size: 13px; color: #6b7280; margin: 0; }
    .title-block .meta { font-size: 11px; color: #9ca3af; margin-top: 6px; }
    
    /* Content */
    .content { padding: 16px 32px 24px; max-width: 100%; }
    .category-badge { display: inline-block; background: hsl(160, 84%, 39%); color: #fff; font-size: 11px; padding: 2px 10px; border-radius: 12px; margin-bottom: 12px; }
    .disclaimer { background: #fff8e1; border-left: 3px solid #f6ad55; padding: 10px 14px; margin-top: 20px; font-size: 11px; color: #744210; border-radius: 4px; }
    
    /* Footer */
    .letterhead-footer { margin-top: auto; padding-top: 12px; }
    .footer-content { display: flex; justify-content: space-between; align-items: center; padding: 10px 32px; font-size: 10px; color: #9ca3af; }
    .footer-left { font-weight: 600; }
    .footer-center { text-align: center; }
    .footer-right { font-style: italic; }
    
    /* Sections (for emergency cards etc.) */
    .section { margin-bottom: 12px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
    .section-title { background: #f3f4f6; padding: 8px 14px; font-weight: 700; font-size: 13px; border-bottom: 1px solid #e5e7eb; }
    .section-body { padding: 10px 14px; }
    .row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f3f4f6; }
    .row:last-child { border-bottom: none; }
    .label { color: #6b7280; font-size: 12px; min-width: 140px; }
    .value { font-weight: 500; text-align: right; }
    .badge { display: inline-block; background: #fef2f2; color: #dc2626; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin: 2px; font-weight: 600; }
    .badge-blue { background: #eff6ff; color: #2563eb; }
    .badge-green { background: #f0fdf4; color: #16a34a; }
    .alert-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; }
    .alert-box p { color: #dc2626; font-weight: 600; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #f3f4f6; text-align: left; padding: 6px 10px; font-weight: 600; }
    td { padding: 6px 10px; border-bottom: 1px solid #f3f4f6; }
    
    /* Action bar for interactive cards */
    .action-bar { display: flex; gap: 8px; padding: 12px 32px; flex-wrap: wrap; justify-content: center; }
    .btn { padding: 10px 20px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: opacity 0.2s; }
    .btn:hover { opacity: 0.85; }
    .btn-print { background: #1a1a2e; color: #fff; }
    .btn-whatsapp { background: #25d366; color: #fff; }
    .btn-email { background: #2563eb; color: #fff; }
    @media print { .action-bar { display: none !important; } }
    
    /* QR section */
    .qr-section { display: flex; align-items: center; gap: 14px; padding: 14px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 16px; }
    .qr-section img { border-radius: 6px; border: 2px solid #e5e7eb; }
    .qr-section .qr-text { font-size: 11px; color: #6b7280; }
    .qr-section .qr-text strong { color: #1a1a1a; font-size: 12px; display: block; margin-bottom: 2px; }
  `;
}

function buildHtml(opts: ReportOptions): string {
  const now = new Date();
  const date = opts.date || now.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const time = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const bodyHtml = markdownToHtml(opts.content);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${opts.title} — ${APP_NAME}</title>
<style>${getLetterheadCss()}</style>
</head>
<body>
  ${buildLetterheadHeader()}
  <div class="title-block">
    <h1>${opts.title}</h1>
    ${opts.subtitle ? `<p class="subtitle">${opts.subtitle}</p>` : ""}
    <p class="meta">Generated on: ${date} | ${time}</p>
  </div>
  <div class="content">
    ${opts.category ? `<span class="category-badge">${opts.category}</span>` : ""}
    ${bodyHtml}
    <div class="disclaimer">⚠ This report is generated by AI for informational purposes only. Always consult a qualified healthcare professional for medical decisions.</div>
  </div>
  ${buildLetterheadFooter()}
</body>
</html>`;
}

/**
 * Build a letterhead-wrapped HTML document with custom body content (raw HTML).
 * Use this for emergency cards, medication orders, etc. that have their own structured content.
 */
export function buildLetterheadHtml(opts: {
  title: string;
  subtitle?: string;
  bodyHtml: string;
  actionBarHtml?: string;
  includeDisclaimer?: boolean;
}): string {
  const now = new Date();
  const date = now.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const time = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${opts.title} — ${APP_NAME}</title>
<style>${getLetterheadCss()}</style>
</head>
<body>
  ${opts.actionBarHtml || ""}
  ${buildLetterheadHeader()}
  <div class="title-block">
    <h1>${opts.title}</h1>
    ${opts.subtitle ? `<p class="subtitle">${opts.subtitle}</p>` : ""}
    <p class="meta">Generated on: ${date} | ${time}</p>
  </div>
  <div class="content">
    ${opts.bodyHtml}
    ${opts.includeDisclaimer ? `<div class="disclaimer">⚠ This report is generated by AI for informational purposes only. Always consult a qualified healthcare professional for medical decisions.</div>` : ""}
  </div>
  ${buildLetterheadFooter()}
</body>
</html>`;
}

export function printReport(opts: ReportOptions) {
  const html = buildHtml(opts);
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 400);
}

export function shareViaWhatsApp(opts: ReportOptions) {
  const summary = `*${opts.title}*\n${APP_NAME}\n${opts.date || new Date().toLocaleDateString("en-IN")}\n\n${opts.content.substring(0, 1000)}${opts.content.length > 1000 ? "…" : ""}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(summary)}`, "_blank");
}

export function shareViaEmail(opts: ReportOptions) {
  const subject = `${opts.title} — ${APP_NAME}`;
  const body = `${opts.title}\nDate: ${opts.date || new Date().toLocaleDateString("en-IN")}\n\n${opts.content}`;
  window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_self");
}

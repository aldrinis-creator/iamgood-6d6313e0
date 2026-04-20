import { buildLetterheadHtml } from "./reportPdf";

export interface ReceiptData {
  id: string;
  plan_type: string;
  billing_cycle: string;
  amount_paise: number;
  starts_at: string;
  expires_at: string;
  coupon_code?: string | null;
  razorpay_payment_id?: string | null;
  userName?: string;
}

function formatIST(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

export function printReceipt(data: ReceiptData) {
  const receiptNo = data.id.slice(0, 8).toUpperCase();
  const planName = data.plan_type === "premium-plus"
    ? "Premium Plus"
    : (data.plan_type === "premium" || data.plan_type === "pro")
      ? "Premium"
      : "Basic";
  const billingLabel = data.billing_cycle === "yearly" ? "Yearly" : "Monthly";
  const amount = (data.amount_paise / 100).toFixed(2);

  const rows: [string, string][] = [
    ["Receipt No.", `#${receiptNo}`],
    ["Customer", data.userName || "—"],
    ["Plan", `Check-iN ${planName}`],
    ["Billing Cycle", billingLabel],
    ["Amount Paid", `₹${amount}`],
  ];

  if (data.coupon_code) {
    rows.push(["Coupon Applied", data.coupon_code]);
  }

  rows.push(
    ["Valid From", formatIST(data.starts_at)],
    ["Valid Until", formatIST(data.expires_at)],
  );

  if (data.razorpay_payment_id) {
    rows.push(["Payment Ref.", data.razorpay_payment_id]);
  }

  const tableRows = rows
    .map(([label, value]) => `<tr><td class="label" style="padding:8px 10px;color:#6b7280;font-size:13px;">${label}</td><td style="padding:8px 10px;font-weight:600;text-align:right;">${value}</td></tr>`)
    .join("");

  const bodyHtml = `
    <div style="text-align:center;margin-bottom:20px;">
      <span style="display:inline-block;background:#f0fdf4;color:#16a34a;padding:4px 14px;border-radius:20px;font-size:13px;font-weight:600;">✓ Payment Successful</span>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      ${tableRows}
    </table>
    <div style="margin-top:24px;padding:12px 14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;font-size:11px;color:#6b7280;text-align:center;">
      This is a system-generated receipt from Check-iN by FutureWave Technologies.<br/>
      For queries, contact support@futurewave.in
    </div>
  `;

  const html = buildLetterheadHtml({
    title: "Payment Receipt",
    subtitle: `Check-iN ${planName} — ${billingLabel}`,
    bodyHtml,
    includeDisclaimer: false,
  });

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 400);
}

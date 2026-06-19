import jsPDF from "jspdf";

export interface AdmissionKitPage {
  signedUrl: string;
  fileName: string | null;
  isPdf: boolean;       // legacy: a stored PDF (pre-image-only migration)
}

export interface AdmissionKitDoc {
  slot: string;
  label: string;
  pages: AdmissionKitPage[]; // empty = missing
}

export interface AdmissionKitInput {
  wardName: string;
  wardDob?: string | null;
  wardPhone?: string | null;
  bloodGroup?: string | null;
  allergies?: string[] | null;
  chronicConditions?: string[] | null;
  primaryGuardianName?: string | null;
  primaryGuardianPhone?: string | null;
  emergencyNotes?: string | null;
  docs: AdmissionKitDoc[];
  doctorVisitReport?: { dateISO: string; markdown: string } | null;
}

const NAVY = "#1a365d";

async function fetchAsBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.blob();
  } catch { return null; }
}

/**
 * Load any image (JPEG/PNG/TIF) as a JPEG data URL via canvas so jsPDF can
 * always embed it cleanly. Returns natural pixel dimensions too.
 */
async function loadImageAsJpegDataUrl(url: string): Promise<{ dataUrl: string; width: number; height: number } | null> {
  const blob = await fetchAsBlob(url);
  if (!blob) return null;
  try {
    // Try native <img> decode first (works for JPEG/PNG; TIF will likely fail).
    const objUrl = URL.createObjectURL(blob);
    const img = await new Promise<HTMLImageElement | null>((resolve) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => resolve(null);
      i.src = objUrl;
    });
    if (img) {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(objUrl); return null; }
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(objUrl);
      return { dataUrl: canvas.toDataURL("image/jpeg", 0.9), width: canvas.width, height: canvas.height };
    }
    URL.revokeObjectURL(objUrl);
  } catch { /* fall through */ }
  return null;
}

export async function buildAdmissionKitPdf(input: AdmissionKitInput): Promise<Blob> {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 36;

  // ===== Cover page =====
  pdf.setFillColor(NAVY);
  pdf.rect(0, 0, pageW, 80, "F");
  pdf.setTextColor("#ffffff");
  pdf.setFontSize(20);
  pdf.setFont("helvetica", "bold");
  pdf.text("Check-iN — Hospital Admission Kit", margin, 50);
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Generated ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`, margin, 68);

  let y = 110;
  pdf.setTextColor("#000000");
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.text(input.wardName, margin, y);
  y += 22;

  pdf.setFontSize(11);
  pdf.setFont("helvetica", "normal");
  const rows: [string, string][] = [
    ["Date of Birth", input.wardDob || "—"],
    ["Phone", input.wardPhone || "—"],
    ["Blood Group", input.bloodGroup || "—"],
    ["Allergies", (input.allergies && input.allergies.length ? input.allergies.join(", ") : "None reported")],
    ["Chronic Conditions", (input.chronicConditions && input.chronicConditions.length ? input.chronicConditions.join(", ") : "None reported")],
    ["Primary Guardian", `${input.primaryGuardianName || "—"}${input.primaryGuardianPhone ? "  •  " + input.primaryGuardianPhone : ""}`],
  ];
  for (const [k, v] of rows) {
    pdf.setFont("helvetica", "bold");
    pdf.text(k + ":", margin, y);
    pdf.setFont("helvetica", "normal");
    const lines = pdf.splitTextToSize(String(v), pageW - margin * 2 - 130);
    pdf.text(lines, margin + 130, y);
    y += 16 * Math.max(1, lines.length);
  }

  if (input.emergencyNotes) {
    y += 10;
    pdf.setFont("helvetica", "bold");
    pdf.text("Emergency Notes:", margin, y); y += 14;
    pdf.setFont("helvetica", "normal");
    const lines = pdf.splitTextToSize(input.emergencyNotes, pageW - margin * 2);
    pdf.text(lines, margin, y);
    y += 14 * lines.length;
  }

  y += 16;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text("Documents Included", margin, y); y += 18;
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "normal");
  for (const d of input.docs) {
    const n = d.pages.length;
    const status = n === 0 ? "✗ Missing" : `✓ ${n} page${n > 1 ? "s" : ""} embedded`;
    pdf.text(`• ${d.label}`, margin, y);
    pdf.text(status, pageW - margin, y, { align: "right" });
    y += 16;
  }

  pdf.setFontSize(9);
  pdf.setTextColor("#666666");
  pdf.text("Generated via Check-iN. Verify originals at admission.", margin, pageH - 24);

  // ===== Document pages =====
  for (const d of input.docs) {
    if (!d.pages.length) continue;
    for (let i = 0; i < d.pages.length; i++) {
      const p = d.pages[i];

      if (p.isPdf) {
        // Legacy stored PDF: cannot embed inline — add link page.
        pdf.addPage();
        pdf.setFillColor(NAVY); pdf.rect(0, 0, pageW, 40, "F");
        pdf.setTextColor("#ffffff"); pdf.setFontSize(13); pdf.setFont("helvetica", "bold");
        pdf.text(`${d.label} — Page ${i + 1} of ${d.pages.length}`, margin, 26);
        pdf.setTextColor("#000000"); pdf.setFontSize(11); pdf.setFont("helvetica", "normal");
        pdf.text("Original is a PDF (legacy). Open the secure link below:", margin, 80);
        pdf.setTextColor(NAVY);
        const lines = pdf.splitTextToSize(p.signedUrl, pageW - margin * 2);
        pdf.textWithLink(lines.join("\n"), margin, 110, { url: p.signedUrl });
        continue;
      }

      const img = await loadImageAsJpegDataUrl(p.signedUrl);
      if (!img) continue;

      pdf.addPage();
      pdf.setFillColor(NAVY); pdf.rect(0, 0, pageW, 40, "F");
      pdf.setTextColor("#ffffff"); pdf.setFontSize(13); pdf.setFont("helvetica", "bold");
      const header = d.pages.length > 1 ? `${d.label} — Page ${i + 1} of ${d.pages.length}` : d.label;
      pdf.text(header, margin, 26);

      const maxW = pageW - margin * 2;
      const maxH = pageH - 80 - margin;
      const ratio = Math.min(maxW / img.width, maxH / img.height);
      const w = img.width * ratio;
      const h = img.height * ratio;
      const x = (pageW - w) / 2;
      const yImg = 60;
      try {
        pdf.addImage(img.dataUrl, "JPEG", x, yImg, w, h, undefined, "FAST");
      } catch { /* ignore */ }
    }
  }

  // ===== Doctor Visit Report (text section) =====
  if (input.doctorVisitReport && input.doctorVisitReport.markdown?.trim()) {
    const dateStr = (() => {
      try { return new Date(input.doctorVisitReport!.dateISO).toLocaleDateString("en-IN"); }
      catch { return input.doctorVisitReport!.dateISO; }
    })();
    pdf.addPage();
    pdf.setFillColor(NAVY); pdf.rect(0, 0, pageW, 40, "F");
    pdf.setTextColor("#ffffff"); pdf.setFontSize(13); pdf.setFont("helvetica", "bold");
    pdf.text(`Doctor Visit Report — ${dateStr}`, margin, 26);

    pdf.setTextColor("#000000");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);

    // Strip basic markdown for cleaner PDF rendering
    const clean = input.doctorVisitReport.markdown
      .replace(/```[\s\S]*?```/g, "")
      .replace(/[`*_>#]/g, "")
      .replace(/\r/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    const maxW = pageW - margin * 2;
    const lines = pdf.splitTextToSize(clean, maxW);
    const lineH = 13;
    let yT = 60;
    for (const line of lines) {
      if (yT > pageH - margin) {
        pdf.addPage();
        pdf.setFillColor(NAVY); pdf.rect(0, 0, pageW, 40, "F");
        pdf.setTextColor("#ffffff"); pdf.setFontSize(13); pdf.setFont("helvetica", "bold");
        pdf.text(`Doctor Visit Report — ${dateStr} (cont.)`, margin, 26);
        pdf.setTextColor("#000000"); pdf.setFont("helvetica", "normal"); pdf.setFontSize(10);
        yT = 60;
      }
      pdf.text(line, margin, yT);
      yT += lineH;
    }
  }

  return pdf.output("blob");
}

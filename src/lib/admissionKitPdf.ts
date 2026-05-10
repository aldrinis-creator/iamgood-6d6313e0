import jsPDF from "jspdf";

export interface AdmissionKitDoc {
  slot: string;
  label: string;
  fileName: string | null;
  signedUrl: string | null;
  isPdf: boolean;
  isImage: boolean;
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
}

const NAVY = "#1a365d";

async function loadImageAsDataURL(url: string): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const img = new Image();
        img.onload = () => resolve({ dataUrl, width: img.width, height: img.height });
        img.onerror = () => reject(new Error("img decode failed"));
        img.src = dataUrl;
      };
      reader.onerror = () => reject(new Error("blob read failed"));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function buildAdmissionKitPdf(input: AdmissionKitInput): Promise<Blob> {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 36;

  // ===== Cover page =====
  // Header bar
  pdf.setFillColor(NAVY);
  pdf.rect(0, 0, pageW, 80, "F");
  pdf.setTextColor("#ffffff");
  pdf.setFontSize(20);
  pdf.setFont("helvetica", "bold");
  pdf.text("Check-iN — Hospital Admission Kit", margin, 50);
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Generated ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`, margin, 68);

  // Patient block
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

  // Document index
  y += 16;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text("Documents Included", margin, y); y += 18;
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "normal");
  for (const d of input.docs) {
    const status = d.signedUrl ? (d.isImage ? "✓ Embedded" : d.isPdf ? "↗ See PDF link" : "✓ Attached") : "✗ Missing";
    pdf.text(`• ${d.label}`, margin, y);
    pdf.text(status, pageW - margin, y, { align: "right" });
    y += 16;
  }

  // Footer
  pdf.setFontSize(9);
  pdf.setTextColor("#666666");
  pdf.text("Generated via Check-iN. Verify originals at admission.", margin, pageH - 24);

  // ===== Document pages =====
  for (const d of input.docs) {
    if (!d.signedUrl) continue;
    if (d.isImage) {
      const img = await loadImageAsDataURL(d.signedUrl);
      if (!img) continue;
      pdf.addPage();
      // Title
      pdf.setFillColor(NAVY);
      pdf.rect(0, 0, pageW, 40, "F");
      pdf.setTextColor("#ffffff");
      pdf.setFontSize(13);
      pdf.setFont("helvetica", "bold");
      pdf.text(d.label, margin, 26);

      // Fit image
      const maxW = pageW - margin * 2;
      const maxH = pageH - 80 - margin;
      const ratio = Math.min(maxW / img.width, maxH / img.height);
      const w = img.width * ratio;
      const h = img.height * ratio;
      const x = (pageW - w) / 2;
      const yImg = 60;
      try {
        pdf.addImage(img.dataUrl, "JPEG", x, yImg, w, h, undefined, "FAST");
      } catch {
        try { pdf.addImage(img.dataUrl, "PNG", x, yImg, w, h, undefined, "FAST"); } catch { /* ignore */ }
      }
    } else if (d.isPdf) {
      pdf.addPage();
      pdf.setFillColor(NAVY);
      pdf.rect(0, 0, pageW, 40, "F");
      pdf.setTextColor("#ffffff");
      pdf.setFontSize(13);
      pdf.setFont("helvetica", "bold");
      pdf.text(d.label, margin, 26);
      pdf.setTextColor("#000000");
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      pdf.text("Original is a PDF document. Open the secure link below to view/download:", margin, 80);
      pdf.setTextColor(NAVY);
      const link = d.signedUrl;
      const lines = pdf.splitTextToSize(link, pageW - margin * 2);
      pdf.textWithLink(lines.join("\n"), margin, 110, { url: link });
    }
  }

  return pdf.output("blob");
}

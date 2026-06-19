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

export interface ProfileSnapshotMedication {
  name: string;
  dosage?: string | null;
  frequency?: string | null;
  remaining_quantity?: number | null;
  total_quantity?: number | null;
}

export interface ProfileSnapshotHistory {
  type: string; // "hospitalization" | "surgery"
  reason: string;
  nature?: string | null;
  hospital_name?: string | null;
  doctor_name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  treatment?: string | null;
  medications?: string | null;
  advice?: string | null;
}

export interface ProfileSnapshot {
  personal: {
    full_name?: string | null;
    date_of_birth?: string | null;
    age?: number | null;
    phone?: string | null;
    gender?: string | null;
  };
  bodyMetrics: {
    weight_kg?: number | null;
    height_m?: number | null;
    bmi?: number | null;
    bmi_label?: string | null;
  };
  bodyHealth: {
    blood_group?: string | null;
    diet_type?: string | null;
    allergies?: string[] | null;
    medical_conditions?: string[] | null;
    activity_level?: string | null;
    smoking?: string | null;
    alcohol?: string | null;
    dietary_preferences?: string[] | null;
    health_goals?: string[] | null;
  };
  familyDoctor: {
    name?: string | null;
    phone?: string | null;
  };
  medications: ProfileSnapshotMedication[];
  medicalHistory: ProfileSnapshotHistory[];
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
  profileSnapshot?: ProfileSnapshot | null;
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

  // ===== Ward Profile Snapshot =====
  if (input.profileSnapshot) {
    const snap = input.profileSnapshot;
    const lineH = 14;
    const labelW = 150;
    const maxW = pageW - margin * 2;
    let yS = 0;

    const ensureSpace = (needed: number, contTitle?: string) => {
      if (yS === 0 || yS + needed > pageH - margin) {
        pdf.addPage();
        pdf.setFillColor(NAVY); pdf.rect(0, 0, pageW, 40, "F");
        pdf.setTextColor("#ffffff"); pdf.setFontSize(13); pdf.setFont("helvetica", "bold");
        pdf.text(contTitle || "Ward Profile Snapshot", margin, 26);
        pdf.setTextColor("#000000");
        yS = 60;
      }
    };

    const drawSectionHeader = (title: string) => {
      ensureSpace(40);
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(12); pdf.setTextColor(NAVY);
      pdf.text(title, margin, yS);
      yS += 6;
      pdf.setDrawColor(NAVY); pdf.setLineWidth(0.8);
      pdf.line(margin, yS, pageW - margin, yS);
      yS += 12;
      pdf.setTextColor("#000000");
    };

    const drawRow = (label: string, value: string) => {
      const text = value && value.trim() ? value : "—";
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(10);
      const wrapped = pdf.splitTextToSize(text, maxW - labelW);
      const need = lineH * Math.max(1, wrapped.length);
      ensureSpace(need + 4);
      pdf.setFont("helvetica", "bold");
      pdf.text(label, margin, yS);
      pdf.setFont("helvetica", "normal");
      pdf.text(wrapped, margin + labelW, yS);
      yS += need;
    };

    const drawNote = (text: string) => {
      pdf.setFont("helvetica", "italic"); pdf.setFontSize(10); pdf.setTextColor("#666666");
      ensureSpace(lineH + 4);
      pdf.text(text, margin, yS);
      yS += lineH;
      pdf.setTextColor("#000000");
    };

    const fmtList = (arr?: string[] | null) =>
      arr && arr.length ? arr.join(", ") : "";
    const fmtNum = (n?: number | null, suffix = "") =>
      n != null && !Number.isNaN(n) ? `${n}${suffix}` : "";
    const fmtDate = (d?: string | null) => {
      if (!d) return "";
      try { return new Date(d).toLocaleDateString("en-IN"); } catch { return d; }
    };

    // 1. Personal Information
    drawSectionHeader("1. Personal Information");
    drawRow("Full Name:", snap.personal.full_name || "");
    drawRow(
      "Date of Birth:",
      snap.personal.date_of_birth
        ? `${fmtDate(snap.personal.date_of_birth)}${snap.personal.age != null ? ` (${snap.personal.age} yrs)` : ""}`
        : ""
    );
    drawRow("Mobile:", snap.personal.phone || "");
    drawRow("Gender:", snap.personal.gender ? snap.personal.gender.charAt(0).toUpperCase() + snap.personal.gender.slice(1) : "");
    yS += 8;

    // 2. Current Medications
    drawSectionHeader("2. Current Medications");
    if (snap.medications.length === 0) {
      drawNote("No active medications recorded.");
    } else {
      for (const m of snap.medications) {
        const stock = (m.remaining_quantity != null && m.total_quantity != null)
          ? `  •  Stock: ${m.remaining_quantity}/${m.total_quantity}`
          : "";
        const parts = [m.dosage, m.frequency].filter(Boolean).join(", ");
        drawRow(`• ${m.name}`, `${parts}${stock}`);
      }
    }
    yS += 8;

    // 3. Body Metrics
    drawSectionHeader("3. Body Metrics");
    drawRow("Weight:", fmtNum(snap.bodyMetrics.weight_kg, " kg"));
    drawRow("Height:", fmtNum(snap.bodyMetrics.height_m, " m"));
    drawRow(
      "BMI:",
      snap.bodyMetrics.bmi != null
        ? `${snap.bodyMetrics.bmi.toFixed(1)}${snap.bodyMetrics.bmi_label ? ` — ${snap.bodyMetrics.bmi_label}` : ""}`
        : ""
    );
    yS += 8;

    // 4. Body & Health
    drawSectionHeader("4. Body & Health");
    drawRow("Blood Group:", snap.bodyHealth.blood_group || "");
    drawRow("Diet Type:", snap.bodyHealth.diet_type ? snap.bodyHealth.diet_type.replace(/-/g, " ") : "");
    drawRow("Allergies:", fmtList(snap.bodyHealth.allergies));
    drawRow("Medical Conditions:", fmtList(snap.bodyHealth.medical_conditions));
    drawRow("Activity Level:", snap.bodyHealth.activity_level || "");
    drawRow("Smoking:", snap.bodyHealth.smoking || "");
    drawRow("Alcohol:", snap.bodyHealth.alcohol || "");
    if (snap.bodyHealth.dietary_preferences && snap.bodyHealth.dietary_preferences.length) {
      drawRow("Dietary Preferences:", fmtList(snap.bodyHealth.dietary_preferences));
    }
    if (snap.bodyHealth.health_goals && snap.bodyHealth.health_goals.length) {
      drawRow("Health Goals:", fmtList(snap.bodyHealth.health_goals));
    }
    yS += 8;

    // 5. Past Medical History
    drawSectionHeader("5. Past Medical History");
    const hosp = snap.medicalHistory.filter((h) => h.type === "hospitalization");
    const surg = snap.medicalHistory.filter((h) => h.type === "surgery");
    const other = snap.medicalHistory.filter((h) => h.type !== "hospitalization" && h.type !== "surgery");

    const drawHistoryGroup = (title: string, items: typeof snap.medicalHistory) => {
      if (!items.length) return;
      ensureSpace(lineH + 8);
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(10.5);
      pdf.text(title, margin, yS);
      yS += lineH;
      for (const h of items) {
        const head = `• ${h.reason}${h.nature ? ` (${h.nature})` : ""}`;
        const meta = [
          h.hospital_name ? `at ${h.hospital_name}` : "",
          h.start_date ? `from ${fmtDate(h.start_date)}` : "",
          h.end_date ? `to ${fmtDate(h.end_date)}` : "",
          h.doctor_name ? `Dr. ${h.doctor_name}` : "",
        ].filter(Boolean).join("  •  ");
        drawRow(head, meta);
        if (h.treatment) drawRow("   Treatment:", h.treatment);
        if (h.medications) drawRow("   Medications:", h.medications);
        if (h.advice) drawRow("   Advice:", h.advice);
      }
    };

    if (!hosp.length && !surg.length && !other.length) {
      drawNote("No past hospitalizations or surgeries recorded.");
    } else {
      drawHistoryGroup("Hospitalizations", hosp);
      drawHistoryGroup("Surgeries", surg);
      drawHistoryGroup("Other", other);
    }
    yS += 8;

    // 6. Family Doctor
    drawSectionHeader("6. Family Doctor");
    drawRow("Doctor Name:", snap.familyDoctor.name || "");
    drawRow("Doctor Phone:", snap.familyDoctor.phone || "");
  }



  return pdf.output("blob");
}

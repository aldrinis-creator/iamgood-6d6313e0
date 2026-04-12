import * as pdfjsLib from "pdfjs-dist";

// Use CDN worker for pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const MAX_PAGES = 10;

function withTimeout<T>(promise: Promise<T>, ms: number, msg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(msg)), ms)),
  ]);
}

export function isPDF(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function isDOCX(file: File): boolean {
  return (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.name.toLowerCase().endsWith(".docx") ||
    file.name.toLowerCase().endsWith(".doc")
  );
}

export function isDocument(file: File): boolean {
  return isPDF(file) || isDOCX(file);
}

export async function extractTextFromPDF(file: File): Promise<{ text: string; hasText: boolean }> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await withTimeout(
    pdfjsLib.getDocument({ data: arrayBuffer }).promise,
    15000,
    "PDF loading timed out. Try a smaller file or paste the text manually."
  );
  const pageCount = Math.min(pdf.numPages, MAX_PAGES);
  let fullText = "";

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str)
      .join(" ");
    fullText += `--- Page ${i} ---\n${pageText}\n\n`;
  }

  const trimmed = fullText.trim();
  // Consider "has text" if we got more than 50 meaningful characters
  return { text: trimmed, hasText: trimmed.replace(/---\s*Page\s*\d+\s*---/g, "").trim().length > 50 };
}

export async function renderPDFPageToImage(file: File, pageNum = 1): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await withTimeout(
    pdfjsLib.getDocument({ data: arrayBuffer }).promise,
    15000,
    "PDF loading timed out"
  );
  const page = await pdf.getPage(pageNum);
  const scale = 1.5;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;

  await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
  return canvas.toDataURL("image/jpeg", 0.7);
}

export async function extractTextFromDOCX(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

export function getFileTypeLabel(file: File): string {
  if (isPDF(file)) return "PDF";
  if (isDOCX(file)) return "Word Document";
  return "Document";
}

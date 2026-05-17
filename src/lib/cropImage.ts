/**
 * Shared crop / image-export helpers used by Medical Vault attachments and
 * the Profile → ID & Insurance multi-page capture flow.
 *
 * - Loads an image (data URL or object URL)
 * - Renders a (cropped + rotated) region to a JPEG `File`
 * - Downscales to MAX_LONG_EDGE and re-encodes to fit MAX_OUTPUT
 */
import type { Area } from "react-easy-crop";

export const CROP_LIMITS = {
  MAX_IMAGE_INPUT: 5 * 1024 * 1024,      // 5 MB raw image upload
  MAX_PDF_INPUT: 10 * 1024 * 1024,       // 10 MB PDF upload
  MAX_OUTPUT: 1.5 * 1024 * 1024,         // 1.5 MB per page after compression
  MAX_LONG_EDGE: 2000,                   // px
  JPEG_QUALITY_HI: 0.85,
  JPEG_QUALITY_LO: 0.7,
};

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Render the cropped+rotated region to a JPEG `File`, downscaled to
 * MAX_LONG_EDGE, re-encoded to fit MAX_OUTPUT. Returns null if it can't
 * fit under the cap.
 */
export async function exportCropToFile(
  src: string,
  crop: Area | null,
  rotation: number,
  originalName: string,
): Promise<File | null> {
  const img = await loadImage(src);
  const rad = (rotation * Math.PI) / 180;

  const sx = crop?.x ?? 0;
  const sy = crop?.y ?? 0;
  const sw = crop?.width ?? img.width;
  const sh = crop?.height ?? img.height;

  const longEdge = Math.max(sw, sh);
  const scale = longEdge > CROP_LIMITS.MAX_LONG_EDGE ? CROP_LIMITS.MAX_LONG_EDGE / longEdge : 1;
  const outW = Math.round(sw * scale);
  const outH = Math.round(sh * scale);

  const rotated = rotation % 180 !== 0;
  const canvasW = rotated ? outH : outW;
  const canvasH = rotated ? outW : outH;

  const canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.translate(canvasW / 2, canvasH / 2);
  ctx.rotate(rad);
  ctx.drawImage(img, sx, sy, sw, sh, -outW / 2, -outH / 2, outW, outH);

  const toBlob = (q: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", q));

  let blob = await toBlob(CROP_LIMITS.JPEG_QUALITY_HI);
  if (blob && blob.size > CROP_LIMITS.MAX_OUTPUT) blob = await toBlob(CROP_LIMITS.JPEG_QUALITY_LO);
  if (!blob) return null;
  if (blob.size > CROP_LIMITS.MAX_OUTPUT) return null;

  const base = originalName.replace(/\.[^.]+$/, "") || "attachment";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}

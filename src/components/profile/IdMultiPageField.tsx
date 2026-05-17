/**
 * IdMultiPageField
 *
 * Captures one or more pages for an ID & Insurance slot, with the same
 * crop + size-limit UX as the Medical Vault. Pages are merged into a
 * single JPEG-embedded PDF (via jsPDF) and handed back to the parent
 * via `onComplete(file)` for upload.
 *
 * Modes:
 *  - "single"     → exactly one page, output JPEG
 *  - "front-back" → two labeled pages (Front, Back), output PDF
 *  - "pages"      → unlimited labeled pages (Page 1, 2…), output PDF
 */
import { useCallback, useRef, useState } from "react";
import jsPDF from "jspdf";
import Cropper, { Area } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Camera, Upload, X, Loader2, Plus, RotateCw, FileText, Save } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import {
  CROP_LIMITS, formatBytes, fileToDataUrl, exportCropToFile, loadImage,
} from "@/lib/cropImage";

const { MAX_IMAGE_INPUT, MAX_PDF_INPUT } = CROP_LIMITS;
const MAX_MERGED_PDF = 8 * 1024 * 1024; // 8 MB cap after merge

export type CaptureMode = "single" | "front-back" | "pages";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: CaptureMode;
  slotLabel: string;
  baseFileName: string;       // e.g. "aadhaar"
  maxPages?: number;          // default 10 for "pages"
  uploading?: boolean;
  onComplete: (file: File) => void | Promise<void>;
}

interface PageItem {
  id: string;
  label: string;
  file: File;           // already cropped JPEG
  previewUrl: string;   // object URL for thumbnail
}

const ASPECTS: { label: string; value: number | undefined }[] = [
  { label: "Free", value: undefined },
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "ID", value: 1.586 },
];

function defaultLabelFor(mode: CaptureMode, index: number): string {
  if (mode === "front-back") return index === 0 ? "Front" : "Back";
  return `Page ${index + 1}`;
}

function expectedPageCount(mode: CaptureMode, maxPages: number): number {
  if (mode === "single") return 1;
  if (mode === "front-back") return 2;
  return maxPages;
}

/**
 * Merge an ordered list of JPEG files into a single PDF (A4, fit-to-page).
 * Returns null if the resulting PDF exceeds MAX_MERGED_PDF.
 */
async function mergeToPdf(pages: PageItem[], fileName: string): Promise<File | null> {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 24;
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2 - 18; // leave room for label
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    if (i > 0) pdf.addPage();
    const dataUrl = await fileToDataUrl(p.file);
    const img = await loadImage(dataUrl);
    const ratio = Math.min(maxW / img.width, maxH / img.height);
    const w = img.width * ratio;
    const h = img.height * ratio;
    const x = (pageW - w) / 2;
    const y = margin + 18;
    pdf.setFontSize(10);
    pdf.setTextColor("#444");
    pdf.text(`${p.label}`, margin, margin + 12);
    pdf.addImage(dataUrl, "JPEG", x, y, w, h, undefined, "FAST");
  }
  const blob = pdf.output("blob");
  if (blob.size > MAX_MERGED_PDF) return null;
  return new File([blob], `${fileName}.pdf`, { type: "application/pdf" });
}

const IdMultiPageField = ({
  open, onOpenChange, mode, slotLabel, baseFileName,
  maxPages = 10, uploading, onComplete,
}: Props) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const [pages, setPages] = useState<PageItem[]>([]);
  const [busy, setBusy] = useState(false);

  // Crop state for the page currently being added
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string>("");
  const [cropName, setCropName] = useState<string>("photo.jpg");
  const [cropPos, setCropPos] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspectIdx, setAspectIdx] = useState(0);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);

  const maxCount = expectedPageCount(mode, maxPages);
  const canAddMore = pages.length < maxCount;

  const reset = useCallback(() => {
    pages.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPages([]);
    setCropSrc("");
    setCropOpen(false);
  }, [pages]);

  const handleClose = (next: boolean) => {
    if (!next && !busy && !uploading) reset();
    onOpenChange(next);
  };

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedArea(areaPixels);
  }, []);

  const handlePicked = async (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      // Accept PDF as a single-page short-circuit only in non-single modes
      if (f.type === "application/pdf" && mode === "single") {
        if (f.size > MAX_PDF_INPUT) {
          toast.error(`PDF too large (${formatBytes(f.size)}). Max ${formatBytes(MAX_PDF_INPUT)}.`);
          return;
        }
        await onComplete(f);
        onOpenChange(false);
        return;
      }
      toast.error("Please pick an image.");
      return;
    }
    if (f.size > MAX_IMAGE_INPUT) {
      toast.error(`Image too large (${formatBytes(f.size)}). Max ${formatBytes(MAX_IMAGE_INPUT)}.`);
      return;
    }
    try {
      const src = await fileToDataUrl(f);
      setCropSrc(src);
      setCropName(f.name);
      setCropPos({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
      setAspectIdx(0);
      setCroppedArea(null);
      setCropOpen(true);
    } catch {
      toast.error("Could not read image.");
    }
  };

  const finalizeCrop = async (useFull: boolean) => {
    setBusy(true);
    try {
      const out = await exportCropToFile(
        cropSrc,
        useFull ? null : croppedArea,
        rotation,
        cropName,
      );
      if (!out) {
        toast.error(`Could not compress under ${formatBytes(CROP_LIMITS.MAX_OUTPUT)}. Try a smaller crop.`);
        return;
      }
      const label = defaultLabelFor(mode, pages.length);
      const item: PageItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        label,
        file: out,
        previewUrl: URL.createObjectURL(out),
      };
      setPages((prev) => [...prev, item]);
      setCropOpen(false);
      setCropSrc("");
      // For single mode, auto-save right after the first page
      if (mode === "single") {
        await handleSave([...pages, item]);
      }
    } finally {
      setBusy(false);
    }
  };

  const removePage = (id: string) => {
    setPages((prev) => {
      const next = prev.filter((p) => p.id !== id);
      const removed = prev.find((p) => p.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      // Re-label sequential pages in "pages" mode
      if (mode === "pages") {
        return next.map((p, i) => ({ ...p, label: defaultLabelFor(mode, i) }));
      }
      if (mode === "front-back") {
        return next.map((p, i) => ({ ...p, label: defaultLabelFor(mode, i) }));
      }
      return next;
    });
  };

  const handleSave = async (override?: PageItem[]) => {
    const list = override ?? pages;
    if (list.length === 0) {
      toast.error("Add at least one page first.");
      return;
    }
    setBusy(true);
    try {
      let outFile: File;
      if (mode === "single") {
        outFile = list[0].file;
      } else {
        const merged = await mergeToPdf(list, baseFileName);
        if (!merged) {
          toast.error(`Combined PDF too large (>${formatBytes(MAX_MERGED_PDF)}). Remove a page or re-capture at smaller crop.`);
          return;
        }
        outFile = merged;
      }
      await onComplete(outFile);
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const totalBytes = pages.reduce((s, p) => s + p.file.size, 0);
  const nextLabel = canAddMore ? defaultLabelFor(mode, pages.length) : null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{slotLabel}</DialogTitle>
            <DialogDescription className="text-xs">
              {mode === "single" && "Capture or upload a clear photo. You can crop it before saving."}
              {mode === "front-back" && "Add the front, then the back of the card. Each page can be cropped."}
              {mode === "pages" && `Add up to ${maxPages} pages of your policy. Each page can be cropped.`}
            </DialogDescription>
          </DialogHeader>

          {pages.length > 0 && (
            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
              {pages.map((p, i) => (
                <div key={p.id} className="flex items-center gap-2 p-2 rounded-md border bg-muted/30">
                  <img src={p.previewUrl} alt={p.label} className="w-12 h-12 object-cover rounded shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{p.label}</p>
                    <p className="text-[10px] text-muted-foreground">{formatBytes(p.file.size)}</p>
                  </div>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                    onClick={() => removePage(p.id)} title="Remove page">
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground text-right">
                {pages.length}/{mode === "pages" ? maxPages : maxCount} pages · {formatBytes(totalBytes)}
              </p>
            </div>
          )}

          {canAddMore && (
            <div className="space-y-2">
              {nextLabel && pages.length > 0 && (
                <p className="text-xs text-muted-foreground">Next: <span className="font-medium text-foreground">{nextLabel}</span></p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" size="sm"
                  disabled={busy || !!uploading}
                  onClick={() => cameraRef.current?.click()}>
                  <Camera className="w-3.5 h-3.5 mr-1" /> Take photo
                </Button>
                <Button type="button" variant="outline" size="sm"
                  disabled={busy || !!uploading}
                  onClick={() => fileRef.current?.click()}>
                  <Upload className="w-3.5 h-3.5 mr-1" /> Upload file
                </Button>
              </div>
              {mode === "single" && (
                <p className="text-[10px] text-muted-foreground">
                  PDFs allowed for this slot. Images up to {formatBytes(MAX_IMAGE_INPUT)}.
                </p>
              )}
            </div>
          )}

          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => { handlePicked(e.target.files?.[0] || null); e.target.value = ""; }}
          />
          <input
            ref={fileRef}
            type="file"
            accept={mode === "single" ? "image/*,.pdf" : "image/*"}
            className="hidden"
            onChange={(e) => { handlePicked(e.target.files?.[0] || null); e.target.value = ""; }}
          />

          <DialogFooter className="gap-2 sm:gap-2 flex-row">
            <Button type="button" variant="ghost" size="sm" disabled={busy || !!uploading}
              onClick={() => handleClose(false)}>
              Cancel
            </Button>
            {mode !== "single" && (
              <Button type="button" size="sm" className="ml-auto"
                disabled={busy || !!uploading || pages.length === 0}
                onClick={() => handleSave()}>
                {busy || uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                Save {pages.length > 0 ? `(${pages.length})` : ""}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Crop dialog */}
      <Dialog open={cropOpen} onOpenChange={(o) => { if (!o && !busy) { setCropOpen(false); setCropSrc(""); } }}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle>Crop {defaultLabelFor(mode, pages.length)}</DialogTitle>
            <DialogDescription className="text-xs">
              Drag to position, pinch or use slider to zoom.
            </DialogDescription>
          </DialogHeader>

          <div className="relative w-full h-[55vh] bg-black">
            {cropSrc && (
              <Cropper
                image={cropSrc}
                crop={cropPos}
                zoom={zoom}
                rotation={rotation}
                aspect={ASPECTS[aspectIdx].value}
                onCropChange={setCropPos}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                restrictPosition={false}
              />
            )}
          </div>

          <div className="px-4 py-3 space-y-3 border-t">
            <div className="flex items-center gap-2">
              <Label className="text-xs w-12">Zoom</Label>
              <Slider
                min={1} max={3} step={0.05}
                value={[zoom]}
                onValueChange={(v) => setZoom(v[0])}
                className="flex-1"
              />
              <Button type="button" size="icon" variant="outline" className="h-8 w-8"
                onClick={() => setRotation((r) => (r + 90) % 360)} title="Rotate 90°">
                <RotateCw className="w-3.5 h-3.5" />
              </Button>
            </div>

            <div className="flex gap-1">
              {ASPECTS.map((a, i) => (
                <Button
                  key={a.label}
                  type="button"
                  size="sm"
                  variant={i === aspectIdx ? "default" : "outline"}
                  className="flex-1 h-7 text-xs"
                  onClick={() => setAspectIdx(i)}
                >
                  {a.label}
                </Button>
              ))}
            </div>
          </div>

          <DialogFooter className="px-4 pb-4 gap-2 sm:gap-2 flex-row">
            <Button type="button" variant="ghost" size="sm" disabled={busy}
              onClick={() => { setCropOpen(false); setCropSrc(""); }}>
              Cancel
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={busy}
              onClick={() => finalizeCrop(true)}>
              Use original
            </Button>
            <Button type="button" size="sm" disabled={busy || !croppedArea}
              onClick={() => finalizeCrop(false)}>
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
              {mode === "single" ? "Save" : "Add page"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default IdMultiPageField;

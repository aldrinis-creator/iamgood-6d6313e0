/**
 * VaultAttachmentField
 *
 * Photo/scan attachment control for Medical Vault entries with in-app
 * cropping and enforced size limits. Encryption + upload happen in the
 * parent (`VaultCategorisedSection`) — this component only produces a
 * trimmed, compressed `File`.
 */
import { useCallback, useRef, useState } from "react";
import Cropper, { Area } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Camera, Upload, X, Eye, Loader2, Paperclip, RotateCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { decryptBytes } from "@/lib/encryption";
import type { VaultAttachment } from "@/lib/vaultCategories";
import { toast } from "@/components/ui/sonner";

// ---- Limits (tune here) -------------------------------------------------
const MAX_IMAGE_INPUT = 5 * 1024 * 1024;      // 5 MB raw image upload
const MAX_PDF_INPUT   = 10 * 1024 * 1024;     // 10 MB PDF upload
const MAX_OUTPUT      = 1.5 * 1024 * 1024;    // 1.5 MB after compression
const MAX_LONG_EDGE   = 2000;                 // px
const JPEG_QUALITY_HI = 0.85;
const JPEG_QUALITY_LO = 0.7;
// ------------------------------------------------------------------------

interface Props {
  existing?: VaultAttachment;
  pendingFile: File | null;
  onSelectFile: (file: File | null) => void;
  removed: boolean;
  onToggleRemove: (removed: boolean) => void;
  pin: string;
}

const formatBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

const ASPECTS: { label: string; value: number | undefined }[] = [
  { label: "Free", value: undefined },
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "ID", value: 1.586 },
];

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Render cropped+rotated region to a JPEG `File`, downscaled to MAX_LONG_EDGE,
 * re-encoded to fit MAX_OUTPUT. Returns null if it can't fit under the cap.
 */
async function exportCropToFile(
  src: string,
  crop: Area | null,
  rotation: number,
  originalName: string,
): Promise<File | null> {
  const img = await loadImage(src);
  const rad = (rotation * Math.PI) / 180;

  // Source rect (full image if no crop)
  const sx = crop?.x ?? 0;
  const sy = crop?.y ?? 0;
  const sw = crop?.width ?? img.width;
  const sh = crop?.height ?? img.height;

  // Downscale to MAX_LONG_EDGE
  const longEdge = Math.max(sw, sh);
  const scale = longEdge > MAX_LONG_EDGE ? MAX_LONG_EDGE / longEdge : 1;
  const outW = Math.round(sw * scale);
  const outH = Math.round(sh * scale);

  // Handle rotation: swap dims for 90/270
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

  let blob = await toBlob(JPEG_QUALITY_HI);
  if (blob && blob.size > MAX_OUTPUT) blob = await toBlob(JPEG_QUALITY_LO);
  if (!blob) return null;
  if (blob.size > MAX_OUTPUT) return null;

  const base = originalName.replace(/\.[^.]+$/, "") || "attachment";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}

const VaultAttachmentField = ({
  existing, pendingFile, onSelectFile, removed, onToggleRemove, pin,
}: Props) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  // View / decrypt existing
  const [viewOpen, setViewOpen] = useState(false);
  const [viewUrl, setViewUrl] = useState<string>("");
  const [viewMime, setViewMime] = useState<string>("");
  const [viewLoading, setViewLoading] = useState(false);

  // Crop state
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string>("");
  const [cropName, setCropName] = useState<string>("photo.jpg");
  const [cropPos, setCropPos] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspectIdx, setAspectIdx] = useState(0);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [exporting, setExporting] = useState(false);

  const showExisting = !!existing && !removed && !pendingFile;

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedArea(areaPixels);
  }, []);

  const handlePicked = async (f: File | null) => {
    if (!f) return;
    if (f.type === "application/pdf") {
      if (f.size > MAX_PDF_INPUT) {
        toast.error(`PDF too large (${formatBytes(f.size)}). Max ${formatBytes(MAX_PDF_INPUT)}.`);
        return;
      }
      onSelectFile(f);
      onToggleRemove(false);
      return;
    }
    if (!f.type.startsWith("image/")) {
      toast.error("Only images or PDF files are allowed.");
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
    setExporting(true);
    try {
      const out = await exportCropToFile(
        cropSrc,
        useFull ? null : croppedArea,
        rotation,
        cropName,
      );
      if (!out) {
        toast.error(`Could not compress under ${formatBytes(MAX_OUTPUT)}. Try a smaller crop.`);
        return;
      }
      onSelectFile(out);
      onToggleRemove(false);
      setCropOpen(false);
      setCropSrc("");
    } finally {
      setExporting(false);
    }
  };

  const openExisting = async () => {
    if (!existing) return;
    setViewLoading(true);
    setViewOpen(true);
    try {
      const { data, error } = await supabase.storage
        .from("vault-attachments")
        .download(existing.path);
      if (error || !data) throw error || new Error("Download failed");
      const encBuf = await data.arrayBuffer();
      const ciphertextB64 = new TextDecoder().decode(encBuf);
      const plain = await decryptBytes(ciphertextB64, existing.iv, existing.salt, pin);
      const blob = new Blob([plain], { type: existing.mime_type });
      setViewUrl(URL.createObjectURL(blob));
      setViewMime(existing.mime_type);
    } catch (e: any) {
      toast.error(e?.message || "Could not decrypt attachment");
      setViewOpen(false);
    } finally {
      setViewLoading(false);
    }
  };

  const closeView = () => {
    if (viewUrl) URL.revokeObjectURL(viewUrl);
    setViewUrl("");
    setViewMime("");
    setViewOpen(false);
  };

  return (
    <div className="border-t pt-3">
      <Label className="text-xs font-semibold flex items-center gap-1">
        <Paperclip className="w-3 h-3" /> Photo / Scan (optional)
      </Label>
      <p className="text-[11px] text-muted-foreground mb-2">
        Encrypted with your PIN before upload. Images up to {formatBytes(MAX_IMAGE_INPUT)}, PDFs up to {formatBytes(MAX_PDF_INPUT)}.
      </p>

      {showExisting && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 mb-2">
          <Paperclip className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{existing!.file_name}</p>
            <p className="text-[10px] text-muted-foreground">{formatBytes(existing!.size)}</p>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={openExisting}>
            <Eye className="w-3.5 h-3.5 mr-1" /> View
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive"
            onClick={() => onToggleRemove(true)} title="Remove">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {pendingFile && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 mb-2">
          <Paperclip className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{pendingFile.name}</p>
            <p className="text-[10px] text-muted-foreground">{formatBytes(pendingFile.size)} · new</p>
          </div>
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive"
            onClick={() => onSelectFile(null)} title="Remove">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {existing && removed && !pendingFile && (
        <div className="flex items-center justify-between p-2 rounded-md bg-destructive/10 mb-2">
          <p className="text-xs text-destructive">Attachment will be deleted on save</p>
          <Button type="button" size="sm" variant="ghost" onClick={() => onToggleRemove(false)}>
            Undo
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="sm"
          onClick={() => cameraRef.current?.click()}>
          <Camera className="w-3.5 h-3.5 mr-1" /> Take photo
        </Button>
        <Button type="button" variant="outline" size="sm"
          onClick={() => fileRef.current?.click()}>
          <Upload className="w-3.5 h-3.5 mr-1" /> Upload file
        </Button>
      </div>

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
        accept="image/*,.pdf"
        className="hidden"
        onChange={(e) => { handlePicked(e.target.files?.[0] || null); e.target.value = ""; }}
      />

      {/* View existing dialog */}
      <Dialog open={viewOpen} onOpenChange={(o) => { if (!o) closeView(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{existing?.file_name || "Attachment"}</DialogTitle>
            <DialogDescription>Decrypted locally in your browser.</DialogDescription>
          </DialogHeader>
          {viewLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : viewUrl ? (
            viewMime.startsWith("image/") ? (
              <img src={viewUrl} alt={existing?.file_name} className="w-full h-auto rounded" />
            ) : (
              <iframe src={viewUrl} title={existing?.file_name} className="w-full h-[70vh] rounded border" />
            )
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Crop dialog */}
      <Dialog open={cropOpen} onOpenChange={(o) => { if (!o && !exporting) { setCropOpen(false); setCropSrc(""); } }}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle>Crop photo</DialogTitle>
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
            <Button type="button" variant="ghost" size="sm" disabled={exporting}
              onClick={() => { setCropOpen(false); setCropSrc(""); }}>
              Cancel
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={exporting}
              onClick={() => finalizeCrop(true)}>
              Use original
            </Button>
            <Button type="button" size="sm" disabled={exporting || !croppedArea}
              onClick={() => finalizeCrop(false)}>
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              Crop & use
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VaultAttachmentField;

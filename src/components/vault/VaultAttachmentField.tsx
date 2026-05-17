/**
 * VaultAttachmentField
 *
 * Reusable photo/scan attachment control for Medical Vault entries.
 * Lets the user capture a photo or upload an image/PDF, preview a
 * previously-saved (encrypted) attachment, replace, or remove it.
 *
 * Encryption happens in the parent `VaultCategorisedSection` (it owns the
 * PIN). This component only deals with file selection, preview, and
 * deletion-intent — it returns the pending `File` to the parent and
 * surfaces the existing `VaultAttachment` metadata for view/replace.
 */
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Camera, Upload, X, Eye, Loader2, Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { decryptBytes } from "@/lib/encryption";
import type { VaultAttachment } from "@/lib/vaultCategories";
import { toast } from "sonner";

interface Props {
  existing?: VaultAttachment;
  pendingFile: File | null;
  onSelectFile: (file: File | null) => void;
  /** When true, the existing attachment will be cleared on save. */
  removed: boolean;
  onToggleRemove: (removed: boolean) => void;
  pin: string;
}

const formatBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

const VaultAttachmentField = ({
  existing, pendingFile, onSelectFile, removed, onToggleRemove, pin,
}: Props) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewUrl, setViewUrl] = useState<string>("");
  const [viewMime, setViewMime] = useState<string>("");
  const [viewLoading, setViewLoading] = useState(false);

  const showExisting = !!existing && !removed && !pendingFile;

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
      // Encrypted bytes are stored as base64 text in a blob; download returns the raw blob.
      // We stored the *ciphertext base64 string* as the file body for simplicity.
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
        Encrypted with your PIN before upload. Only you can decrypt it.
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
        onChange={(e) => {
          const f = e.target.files?.[0] || null;
          if (f) { onSelectFile(f); onToggleRemove(false); }
          e.target.value = "";
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] || null;
          if (f) { onSelectFile(f); onToggleRemove(false); }
          e.target.value = "";
        }}
      />

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
    </div>
  );
};

export default VaultAttachmentField;

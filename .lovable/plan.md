## Fix: Save Original Document + AI Analysis to Medical Vault

### Problem

When saving from Document Analyzer, only the AI analysis text is stored in `description`. The original scanned document (image/PDF/text) is not saved alongside it. The record type should always be "Doctor's Diagnosis".

### Solution

**File: `src/components/health-tools/DocumentAnalyzer.tsx**` — Update `saveToVault()`:

1. **Upload original document to storage**: If the user uploaded an image or scanned PDF (we have `imageBase64`), upload it to the `medical-documents` bucket and store the path in `file_url` and `file_name`.
2. **Combine original + analysis in `description**`: Prepend the original document content (extracted text from PDF/DOCX, or typed text) before the AI analysis, with a clear separator, so both are preserved in the saved record.
3. **Always use record_type "Doctor's Diagnosis"**: Currently it conditionally uses "AI Analysis" for non-diagnosis categories — change to always save as "Doctor's Diagnosis" per the requirement.
4. **Set `file_name**`: Use the original filename (from `docFileName`) or a generated name for camera captures. 
5. Allow User to give a file name of upto 30 characters. 

### Detailed changes in `saveToVault()`:

```typescript
const saveToVault = async () => {
  if (!user) { toast.error("Please log in to save"); return; }
  setSaving(true);
  try {
    let fileUrl: string | null = null;
    let fileName: string | null = docFileName || null;

    // Upload original image/scan to storage
    if (imageBase64 || imagePreview) {
      const base64Data = imageBase64 || imagePreview;
      const base64Str = base64Data!.split(",")[1];
      const byteArray = Uint8Array.from(atob(base64Str), c => c.charCodeAt(0));
      const ext = base64Data!.includes("image/png") ? "png" : "jpg";
      fileName = fileName || `doc-scan-${Date.now()}.${ext}`;
      const storagePath = `${user.id}/${Date.now()}-${fileName}`;
      
      const { error: uploadErr } = await supabase.storage
        .from("medical-documents")
        .upload(storagePath, byteArray, { contentType: `image/${ext}` });
      if (!uploadErr) fileUrl = storagePath;
    }

    // Build description: original content + separator + AI analysis
    const originalSection = extractedDocText 
      ? extractedDocText.substring(0, 20000)
      : (mode === "text" && textInput) 
        ? textInput.substring(0, 20000) 
        : null;

    const fullDescription = [
      ...(originalSection ? [
        "═══ ORIGINAL DOCUMENT ═══",
        originalSection,
        "",
        "═══ AI ANALYSIS ═══",
      ] : []),
      result,
    ].join("\n").substring(0, 50000);

    const { error } = await supabase.from("medical_records").insert({
      user_id: user.id,
      title: `${selectedCat || "Document"} Analysis — ${new Date().toLocaleDateString("en-IN")}`,
      record_type: "Doctor's Diagnosis",
      description: fullDescription,
      file_name: fileName,
      file_url: fileUrl,
      record_date: new Date().toISOString().split("T")[0],
    });
    if (error) throw error;
    setSaved(true);
    toast.success("Saved to Medical Vault under Doctor's Diagnosis");
  } catch (err: any) {
    console.error("Vault save error:", err);
    toast.error(`Failed to save: ${err?.message || "Unknown error"}`);
  } finally {
    setSaving(false);
  }
};
```

### Files to modify

- `**src/components/health-tools/DocumentAnalyzer.tsx**` — rewrite `saveToVault` to upload original file to storage and combine original + analysis in description, always using "Doctor's Diagnosis" record type.
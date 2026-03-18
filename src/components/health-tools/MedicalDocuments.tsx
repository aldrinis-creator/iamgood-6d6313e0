import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Search, Trash2, Download, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface MedicalRecord {
  id: string;
  title: string;
  record_type: string;
  record_date: string | null;
  file_name: string | null;
  file_url: string | null;
  created_at: string;
}

const RECORD_TYPES = ["Lab Report", "Prescription", "Discharge Summary", "X-Ray / Scan", "Insurance", "Other"];

const MedicalDocuments = () => {
  const { session } = useAuth();
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [recordType, setRecordType] = useState("Lab Report");
  const [file, setFile] = useState<File | null>(null);

  const fetchRecords = useCallback(async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase
      .from("medical_records")
      .select("id, title, record_type, record_date, file_name, file_url, created_at")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });
    if (data) setRecords(data);
  }, [session?.user?.id]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const handleUpload = async () => {
    if (!session?.user?.id || !title) { toast.error("Please enter a title"); return; }
    setUploading(true);
    try {
      let fileUrl = null, fileName = null;
      if (file) {
        const ext = file.name.split(".").pop();
        const path = `${session.user.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("medical-documents").upload(path, file);
        if (uploadErr) throw uploadErr;
        fileUrl = path;
        fileName = file.name;
      }
      await supabase.from("medical_records").insert({
        user_id: session.user.id,
        title,
        record_type: recordType,
        file_url: fileUrl,
        file_name: fileName,
        record_date: new Date().toISOString().split("T")[0],
      });
      toast.success("Document uploaded");
      setTitle(""); setFile(null);
      fetchRecords();
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (r: MedicalRecord) => {
    if (r.file_url) await supabase.storage.from("medical-documents").remove([r.file_url]);
    await supabase.from("medical_records").delete().eq("id", r.id);
    toast.success("Deleted");
    fetchRecords();
  };

  const handleDownload = async (r: MedicalRecord) => {
    if (!r.file_url) return;
    const { data } = await supabase.storage.from("medical-documents").download(r.file_url);
    if (!data) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(data);
    a.download = r.file_name || "document";
    a.click();
  };

  const filtered = records.filter((r) => {
    const matchSearch = !search || r.title.toLowerCase().includes(search.toLowerCase());
    const matchType = !filterType || r.record_type === filterType;
    return matchSearch && matchType;
  });

  return (
    <div className="space-y-4">
      {/* Upload */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Upload className="w-4 h-4 text-primary" /> Upload Document
          </h3>
          <Input placeholder="Document title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <select value={recordType} onChange={(e) => setRecordType(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            {RECORD_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          <Input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <div className="flex gap-2">
            <Button onClick={handleUpload} disabled={uploading} className="flex-1">
              <Upload className="w-3 h-3 mr-1" /> {uploading ? "Uploading..." : "Upload"}
            </Button>
            <Button variant="outline" onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/*";
              input.capture = "environment";
              input.onchange = (e) => setFile((e.target as HTMLInputElement).files?.[0] || null);
              input.click();
            }}>
              <Camera className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search & Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>
      <div className="flex gap-1 flex-wrap">
        <Badge variant={filterType ? "outline" : "default"} className="cursor-pointer text-xs" onClick={() => setFilterType(null)}>All</Badge>
        {RECORD_TYPES.map((t) => (
          <Badge key={t} variant={filterType === t ? "default" : "outline"} className="cursor-pointer text-xs" onClick={() => setFilterType(t)}>{t}</Badge>
        ))}
      </div>

      {/* Records */}
      {filtered.map((r) => (
        <Card key={r.id}>
          <CardContent className="p-3 flex items-center gap-3">
            <FileText className="w-8 h-8 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{r.title}</p>
              <div className="flex gap-2 items-center">
                <Badge variant="secondary" className="text-[10px]">{r.record_type}</Badge>
                {r.record_date && <span className="text-[10px] text-muted-foreground">{r.record_date}</span>}
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              {r.file_url && (
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDownload(r)}>
                  <Download className="w-3 h-3" />
                </Button>
              )}
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(r)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No documents found</p>}
    </div>
  );
};

export default MedicalDocuments;

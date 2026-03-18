import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff, FileText, Shield, Heart, User, Upload, Trash2, Download, File, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const RECORD_TYPES = [
  "Prescription",
  "Lab Report",
  "Discharge Summary",
  "X-Ray / Scan",
  "Insurance Document",
  "Vaccination Record",
  "Other",
];

interface MedicalRecord {
  id: string;
  title: string;
  record_type: string;
  record_date: string | null;
  doctor_name: string | null;
  hospital_name: string | null;
  description: string | null;
  file_name: string | null;
  file_url: string | null;
  created_at: string;
}

const MedicalVault = () => {
  const { session } = useAuth();
  const [showAadhaar, setShowAadhaar] = useState(false);
  const [showPan, setShowPan] = useState(false);

  // Records state
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Upload form state
  const [title, setTitle] = useState("");
  const [recordType, setRecordType] = useState("");
  const [recordDate, setRecordDate] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchRecords = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoadingRecords(true);
    const { data, error } = await supabase
      .from("medical_records")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch records:", error);
    } else {
      setRecords(data ?? []);
    }
    setLoadingRecords(false);
  }, [session?.user?.id]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const resetForm = () => {
    setTitle("");
    setRecordType("");
    setRecordDate("");
    setDoctorName("");
    setHospitalName("");
    setDescription("");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!session?.user?.id) {
      toast.error("Please log in to upload records");
      return;
    }
    if (!title || !recordType) {
      toast.error("Title and record type are required");
      return;
    }

    setUploading(true);
    let fileUrl: string | null = null;
    let fileName: string | null = null;

    try {
      // Upload file if selected
      if (selectedFile) {
        const ext = selectedFile.name.split(".").pop();
        const filePath = `${session.user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("medical-documents")
          .upload(filePath, selectedFile);

        if (uploadError) {
          throw uploadError;
        }

        const { data: urlData } = supabase.storage
          .from("medical-documents")
          .getPublicUrl(filePath);

        fileUrl = urlData.publicUrl;
        fileName = selectedFile.name;
      }

      // Insert record
      const { error: insertError } = await supabase.from("medical_records").insert({
        user_id: session.user.id,
        title,
        record_type: recordType,
        record_date: recordDate || null,
        doctor_name: doctorName || null,
        hospital_name: hospitalName || null,
        description: description || null,
        file_url: fileUrl,
        file_name: fileName,
      });

      if (insertError) throw insertError;

      toast.success("Medical record saved successfully!");
      resetForm();
      fetchRecords();
    } catch (err: any) {
      console.error("Upload failed:", err);
      toast.error(err.message || "Failed to save record");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (record: MedicalRecord) => {
    if (!session?.user?.id) return;

    // Delete file from storage if exists
    if (record.file_url) {
      const pathMatch = record.file_url.match(/medical-documents\/(.+)$/);
      if (pathMatch) {
        await supabase.storage.from("medical-documents").remove([pathMatch[1]]);
      }
    }

    const { error } = await supabase
      .from("medical_records")
      .delete()
      .eq("id", record.id);

    if (error) {
      toast.error("Failed to delete record");
    } else {
      toast.success("Record deleted");
      fetchRecords();
    }
  };

  const handleDownload = async (record: MedicalRecord) => {
    if (!record.file_url || !session?.user?.id) return;

    const pathMatch = record.file_url.match(/medical-documents\/(.+)$/);
    if (!pathMatch) return;

    const { data, error } = await supabase.storage
      .from("medical-documents")
      .download(pathMatch[1]);

    if (error || !data) {
      toast.error("Failed to download file");
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = record.file_name || "download";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <Tabs defaultValue="records">
          <TabsList className="w-full">
            <TabsTrigger value="records" className="flex-1 text-xs">Records</TabsTrigger>
            <TabsTrigger value="profile" className="flex-1 text-xs">My Profile</TabsTrigger>
            <TabsTrigger value="guardian" className="flex-1 text-xs">Guardian</TabsTrigger>
            <TabsTrigger value="vault" className="flex-1 text-xs">Secret Vault</TabsTrigger>
          </TabsList>

          {/* Medical Records Tab */}
          <TabsContent value="records" className="space-y-4 mt-4">
            {/* Upload Form */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Upload className="w-5 h-5 text-primary" />
                  Upload Medical Record
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Title *</Label>
                  <Input
                    placeholder="e.g., Blood Test Report - March 2026"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-base"
                  />
                </div>
                <div>
                  <Label>Record Type *</Label>
                  <Select value={recordType} onValueChange={setRecordType}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      {RECORD_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={recordDate}
                      onChange={(e) => setRecordDate(e.target.value)}
                      className="text-base"
                    />
                  </div>
                  <div>
                    <Label>Doctor</Label>
                    <Input
                      placeholder="Dr. Name"
                      value={doctorName}
                      onChange={(e) => setDoctorName(e.target.value)}
                      className="text-base"
                    />
                  </div>
                </div>
                <div>
                  <Label>Hospital / Clinic</Label>
                  <Input
                    placeholder="Hospital name"
                    value={hospitalName}
                    onChange={(e) => setHospitalName(e.target.value)}
                    className="text-base"
                  />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    placeholder="Additional notes..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="text-base"
                    rows={2}
                  />
                </div>
                <div>
                  <Label>Attach File (PDF, Image, etc.)</Label>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                    className="text-base"
                  />
                </div>
                <Button
                  onClick={handleUpload}
                  disabled={uploading || !title || !recordType}
                  className="w-full"
                  size="lg"
                >
                  {uploading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
                  ) : (
                    <><Upload className="w-4 h-4 mr-2" /> Save Record</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Records List */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  My Records ({records.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {loadingRecords ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : records.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No medical records yet. Upload your first record above.
                  </p>
                ) : (
                  records.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-start justify-between p-3 rounded-lg bg-muted/50 gap-3"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <File className="w-8 h-8 text-primary shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{record.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {record.record_type}
                            {record.record_date && ` • ${new Date(record.record_date).toLocaleDateString("en-IN")}`}
                          </p>
                          {record.doctor_name && (
                            <p className="text-xs text-muted-foreground">{record.doctor_name}</p>
                          )}
                          {record.hospital_name && (
                            <p className="text-xs text-muted-foreground">{record.hospital_name}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {record.file_url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDownload(record)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDelete(record)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile" className="space-y-4 mt-4">
            {/* Health Information */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Heart className="w-5 h-5 text-sos" />
                  Health Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Blood Group</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Select blood group" /></SelectTrigger>
                    <SelectContent>
                      {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                        <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Food Preference</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Select preference" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="veg">Vegetarian</SelectItem>
                      <SelectItem value="nonveg">Non-Vegetarian</SelectItem>
                      <SelectItem value="vegan">Vegan</SelectItem>
                      <SelectItem value="eggetarian">Eggetarian</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Allergies</Label>
                  <Input placeholder="e.g., Penicillin, Peanuts" className="text-base" />
                </div>
                <div>
                  <Label>Medical Conditions</Label>
                  <Input placeholder="e.g., Diabetes, Hypertension" className="text-base" />
                </div>
              </CardContent>
            </Card>

            {/* Family Doctor */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Family Doctor
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Doctor's Name</Label>
                  <Input placeholder="Dr. " className="text-base" />
                </div>
                <div>
                  <Label>Phone Number</Label>
                  <div className="flex gap-2">
                    <Select defaultValue="+91">
                      <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="+91">+91</SelectItem>
                        <SelectItem value="+1">+1</SelectItem>
                        <SelectItem value="+44">+44</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input placeholder="Phone number" className="flex-1 text-base" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Insurance */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5 text-success" />
                  Insurance Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Health Insurance Provider</Label>
                  <Input placeholder="e.g., Star Health" className="text-base" />
                </div>
                <div>
                  <Label>Policy Number</Label>
                  <Input placeholder="Policy number" className="text-base" />
                </div>
                <div>
                  <Label>Life Insurance Provider</Label>
                  <Input placeholder="e.g., LIC" className="text-base" />
                </div>
                <div>
                  <Label>Policy Number</Label>
                  <Input placeholder="Policy number" className="text-base" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="guardian" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">My Guardians</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { name: "Priya Sharma", relation: "Daughter", phone: "+91 98765 43210", primary: true },
                  { name: "Rahul Sharma", relation: "Son", phone: "+91 98765 43211", primary: false },
                ].map((g) => (
                  <div key={g.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium text-sm">{g.name}</p>
                      <p className="text-xs text-muted-foreground">{g.relation} • {g.phone}</p>
                    </div>
                    {g.primary && (
                      <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full">Primary</span>
                    )}
                  </div>
                ))}
                <Button variant="outline" className="w-full">+ Add Guardian</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vault" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  Government ID Cards
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Aadhaar Number</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type={showAadhaar ? "text" : "password"}
                      defaultValue="1234 5678 9012"
                      className="flex-1 text-base"
                    />
                    <button onClick={() => setShowAadhaar(!showAadhaar)} className="p-2">
                      {showAadhaar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <Label>PAN Number</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type={showPan ? "text" : "password"}
                      defaultValue="ABCDE1234F"
                      className="flex-1 text-base"
                    />
                    <button onClick={() => setShowPan(!showPan)} className="p-2">
                      {showPan ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button className="w-full bg-primary" size="lg">
              <FileText className="w-4 h-4 mr-2" />
              Generate Emergency PDF
            </Button>
            <Button variant="outline" className="w-full" size="lg">
              Share with Responder
            </Button>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default MedicalVault;

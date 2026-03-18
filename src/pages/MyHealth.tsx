import { Pill, Stethoscope, Ambulance, Activity, ScanFace, HeartPulse, Apple, Wrench, FileText, Upload, Search, Info, Phone, ChevronRight, ArrowLeft, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AppLayout from "@/components/AppLayout";
import MedicationManager from "@/components/medications/MedicationManager";
import AmbulanceBooking from "@/components/AmbulanceBooking";
import ActivityTracker from "@/components/ActivityTracker";
import NutritionAdvisor from "@/components/NutritionAdvisor";
import WellnessTracker from "@/components/WellnessTracker";
import HealthServices from "@/components/HealthServices";
import FaceScan from "@/components/FaceScan";
import DoctorVisitReport from "@/components/health-tools/DoctorVisitReport";
import MedicalDocuments from "@/components/health-tools/MedicalDocuments";
import DocumentAnalyzer from "@/components/health-tools/DocumentAnalyzer";
import SymptomChecker from "@/components/health-tools/SymptomChecker";
import MedicationInfo from "@/components/health-tools/MedicationInfo";
import TeleConsult from "@/components/health-tools/TeleConsult";
import EmergencyFirstAid from "@/components/health-tools/EmergencyFirstAid";

const healthTools = [
  { icon: Pill, label: "Tablets", color: "bg-primary/10 text-primary" },
  { icon: Stethoscope, label: "Health Tools", color: "bg-success/10 text-success" },
  { icon: Ambulance, label: "Ambulance", color: "bg-sos/10 text-sos" },
  { icon: Activity, label: "Activity", color: "bg-primary/10 text-primary" },
  { icon: ScanFace, label: "Face Scan", color: "bg-success/10 text-success" },
  { icon: HeartPulse, label: "Wellness", color: "bg-primary/10 text-primary" },
  { icon: Apple, label: "Nutrition", color: "bg-success/10 text-success" },
  { icon: Wrench, label: "Services", color: "bg-primary/10 text-primary" },
];

const healthToolsSubItems = [
  { icon: FileText, label: "Doctor Visit Report", desc: "Generate health summary for doctor visits" },
  { icon: Upload, label: "Medical Documents", desc: "Upload and organize medical documents" },
  { icon: Search, label: "Document Analyzer", desc: "AI-powered document analysis" },
  { icon: Stethoscope, label: "Symptom Checker", desc: "AI symptom assessment" },
  { icon: Info, label: "Medication Info", desc: "Drug information & banned list" },
  { icon: Phone, label: "Tele-Consult", desc: "Record & video consult" },
  { icon: ShieldAlert, label: "Emergency First Aid", desc: "Step-by-step first aid guides" },
];

const subToolComponents: Record<string, React.FC> = {
  "Doctor Visit Report": DoctorVisitReport,
  "Medical Documents": MedicalDocuments,
  "Document Analyzer": DocumentAnalyzer,
  "Symptom Checker": SymptomChecker,
  "Medication Info": MedicationInfo,
  "Tele-Consult": TeleConsult,
  "Emergency First Aid": EmergencyFirstAid,
};

const toolComponents: Record<string, React.FC> = {
  "Tablets": MedicationManager,
  "Ambulance": AmbulanceBooking,
  "Activity": ActivityTracker,
  "Nutrition": NutritionAdvisor,
  "Wellness": WellnessTracker,
  "Services": HealthServices,
  "Face Scan": FaceScan,
};

const MyHealth = () => {
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [selectedSubTool, setSelectedSubTool] = useState<string | null>(null);

  // If a sub-tool is selected, render it
  if (selectedSubTool) {
    const SubToolComponent = subToolComponents[selectedSubTool];
    return (
      <AppLayout>
        <div className="p-4 space-y-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedSubTool(null)} className="gap-1">
            <ArrowLeft className="w-4 h-4" /> {selectedSubTool}
          </Button>
          {SubToolComponent && <SubToolComponent />}
        </div>
      </AppLayout>
    );
  }

  // If a tool is selected, render only that tool
  if (selectedTool && selectedTool !== "Health Tools") {
    const ToolComponent = toolComponents[selectedTool];
    return (
      <AppLayout>
        <div className="p-4 space-y-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedTool(null)} className="gap-1">
            <ArrowLeft className="w-4 h-4" /> {selectedTool}
          </Button>
          {ToolComponent && <ToolComponent />}
        </div>
      </AppLayout>
    );
  }

  // If Health Tools is selected, show sub-items only
  if (selectedTool === "Health Tools") {
    return (
      <AppLayout>
        <div className="p-4 space-y-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedTool(null)} className="gap-1">
            <ArrowLeft className="w-4 h-4" /> Health Tools
          </Button>
          <div className="space-y-2">
            {healthToolsSubItems.map((item) => (
              <Card key={item.label} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedSubTool(item.label)}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  // Default: show tools grid
  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <h1 className="text-xl font-bold">My Health</h1>
        <div className="grid grid-cols-3 gap-3">
          {healthTools.map((tool) => (
            <button
              key={tool.label}
              onClick={() => setSelectedTool(tool.label)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-primary/30 transition-all"
            >
              <div className={`w-12 h-12 rounded-full ${tool.color} flex items-center justify-center`}>
                <tool.icon className="w-6 h-6" />
              </div>
              <span className="text-xs font-medium text-center">{tool.label}</span>
            </button>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default MyHealth;

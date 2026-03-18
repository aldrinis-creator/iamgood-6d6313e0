import { Pill, Stethoscope, Ambulance, Activity, ScanFace, HeartPulse, Apple, Wrench, BookOpen, FileText, Upload, Search, Info, Phone, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import AppLayout from "@/components/AppLayout";
import MedicationManager from "@/components/medications/MedicationManager";
import CareJournal from "@/components/CareJournal";
import ActivityTracker from "@/components/ActivityTracker";

const healthTools = [
  { icon: Pill, label: "Tablets", color: "bg-primary/10 text-primary" },
  { icon: Stethoscope, label: "Health Tools", color: "bg-success/10 text-success" },
  { icon: Ambulance, label: "Ambulance", color: "bg-sos/10 text-sos" },
  { icon: Activity, label: "Activity", color: "bg-primary/10 text-primary" },
  { icon: ScanFace, label: "Face Scan", color: "bg-success/10 text-success" },
  { icon: HeartPulse, label: "Wellness", color: "bg-primary/10 text-primary" },
  { icon: Apple, label: "Nutrition", color: "bg-success/10 text-success" },
  { icon: Wrench, label: "Services", color: "bg-primary/10 text-primary" },
  { icon: BookOpen, label: "Care Journal", color: "bg-success/10 text-success" },
];

const healthToolsSubItems = [
  { icon: FileText, label: "Doctor Visit Report", desc: "Record and track doctor visits" },
  { icon: Upload, label: "Medical Documents", desc: "Upload and organize documents" },
  { icon: Search, label: "Document Analyzer", desc: "AI-powered document analysis" },
  { icon: Stethoscope, label: "Symptom Checker", desc: "Check symptoms with AI" },
  { icon: Info, label: "Medication Info", desc: "Drug information & interactions" },
  { icon: Phone, label: "Tele-Consult", desc: "Video consult with a doctor" },
];

const MyHealth = () => {
  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <h1 className="text-xl font-bold">My Health</h1>

        {/* Tools Grid */}
        <div className="grid grid-cols-3 gap-3">
          {healthTools.map((tool) => (
            <button
              key={tool.label}
              onClick={() => setSelectedTool(tool.label === selectedTool ? null : tool.label)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                selectedTool === tool.label
                  ? "border-primary bg-primary/5 shadow-md"
                  : "border-border hover:border-primary/30"
              }`}
            >
              <div className={`w-12 h-12 rounded-full ${tool.color} flex items-center justify-center`}>
                <tool.icon className="w-6 h-6" />
              </div>
              <span className="text-xs font-medium text-center">{tool.label}</span>
            </button>
          ))}
        </div>

        {/* Health Tools Sub-items */}
        {selectedTool === "Health Tools" && (
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Health Tools</h2>
            {healthToolsSubItems.map((item) => (
              <Card key={item.label} className="hover:shadow-md transition-shadow cursor-pointer">
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
        )}

        {/* Ambulance Booking */}
        {selectedTool === "Ambulance" && (
          <Card className="border-sos/30 bg-sos/5">
            <CardContent className="p-4 space-y-3">
              <h2 className="text-lg font-semibold text-sos">🚑 Priority Ambulance</h2>
              <p className="text-sm text-muted-foreground">
                One-tap ambulance booking with priority dispatch.
              </p>
              <div className="bg-card rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>First 5 km</span>
                  <span className="font-semibold">₹1,500</span>
                </div>
                <div className="flex justify-between">
                  <span>After 5 km</span>
                  <span className="font-semibold">₹300/km</span>
                </div>
              </div>
              <button className="w-full py-3 bg-sos text-sos-foreground rounded-lg font-semibold text-accessible">
                🚨 Request Ambulance Now
              </button>
              <p className="text-xs text-center text-muted-foreground">
                Pro subscription required • Available 24/7
              </p>
            </CardContent>
          </Card>
        )}

        {/* Medication Manager */}
        {selectedTool === "Tablets" && <MedicationManager />}

        {/* Care Journal */}
        {selectedTool === "Care Journal" && <CareJournal />}

        {/* Face Scan */}
        {selectedTool === "Face Scan" && (
          <Card className="bg-success/5 border-success/20">
            <CardContent className="p-4 text-center space-y-3">
              <ScanFace className="w-16 h-16 text-success mx-auto" />
              <h2 className="text-lg font-semibold">AI Face Scan</h2>
              <p className="text-sm text-muted-foreground">
                Analyze your vitals through facial recognition. Place your face in front of the camera for 30 seconds.
              </p>
              <button className="w-full py-3 bg-success text-success-foreground rounded-lg font-semibold">
                Start Face Scan
              </button>
              <p className="text-xs text-muted-foreground">Coming soon in Phase 2</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default MyHealth;

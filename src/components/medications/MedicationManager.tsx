import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Pill, Package, Bell, ShieldAlert, Camera, ChevronDown, Settings } from "lucide-react";
import TodaySchedule from "./TodaySchedule";
import MedicationList from "./MedicationList";
import RefillOrder, { type OrderItem } from "./RefillOrder";
import AlarmSettings from "./AlarmSettings";
import BannedMedications from "./BannedMedications";
import PrescriptionScanner from "./PrescriptionScanner";

export interface AlternativeContext {
  medId: string;
  medName: string;
}

export interface SelectedAlternative {
  name: string;
  dosage: string;
  forMedId: string;
}

const MedicationManager = () => {
  const [manageTab, setManageTab] = useState("meds");
  const [manageOpen, setManageOpen] = useState(false);
  const [altContext, setAltContext] = useState<AlternativeContext | null>(null);
  const [selectedAlt, setSelectedAlt] = useState<SelectedAlternative | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  const handleScanAlternative = (medId: string, medName: string) => {
    setAltContext({ medId, medName });
    setManageTab("scan");
    setManageOpen(true);
  };

  const handleSelectAlternative = (alt: { name: string; dosage: string }) => {
    if (!altContext) return;
    setSelectedAlt({ ...alt, forMedId: altContext.medId });
    setAltContext(null);
    setManageTab("refill");
  };

  const handleCancelAltMode = () => {
    setAltContext(null);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Pill className="w-5 h-5 text-primary" />
        Medication Manager
      </h2>

      {/* Today's Schedule — always visible */}
      <TodaySchedule />

      {/* Manage Medications — collapsible */}
      <Collapsible open={manageOpen} onOpenChange={setManageOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm font-medium">
          <Settings className="w-4 h-4 text-muted-foreground" />
          <span className="flex-1 text-left">Manage Medications</span>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${manageOpen ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <Tabs value={manageTab} onValueChange={setManageTab} className="w-full">
            <TabsList className="w-full grid grid-cols-5">
              <TabsTrigger value="meds" className="text-xs gap-1">
                <Pill className="w-3 h-3" /> Meds
              </TabsTrigger>
              <TabsTrigger value="scan" className="text-xs gap-1">
                <Camera className="w-3 h-3" /> Scan
              </TabsTrigger>
              <TabsTrigger value="refill" className="text-xs gap-1">
                <Package className="w-3 h-3" /> Refill
              </TabsTrigger>
              <TabsTrigger value="banned" className="text-xs gap-1">
                <ShieldAlert className="w-3 h-3" /> Banned
              </TabsTrigger>
              <TabsTrigger value="alarms" className="text-xs gap-1">
                <Bell className="w-3 h-3" /> Alarms
              </TabsTrigger>
            </TabsList>

            <TabsContent value="meds"><MedicationList /></TabsContent>
            <TabsContent value="scan">
              <PrescriptionScanner
                alternativeMode={altContext}
                onSelectAlternative={handleSelectAlternative}
                onCancelAltMode={handleCancelAltMode}
              />
            </TabsContent>
            <TabsContent value="refill">
              <RefillOrder
                onScanAlternative={handleScanAlternative}
                selectedAlternative={selectedAlt}
                onClearSelectedAlternative={() => setSelectedAlt(null)}
                orderItems={orderItems}
                setOrderItems={setOrderItems}
              />
            </TabsContent>
            <TabsContent value="banned"><BannedMedications /></TabsContent>
            <TabsContent value="alarms"><AlarmSettings /></TabsContent>
          </Tabs>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default MedicationManager;

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, Pill, Package, Bell, ShieldAlert } from "lucide-react";
import TodaySchedule from "./TodaySchedule";
import MedicationList from "./MedicationList";
import RefillOrder from "./RefillOrder";
import AlarmSettings from "./AlarmSettings";
import BannedMedications from "./BannedMedications";

const MedicationManager = () => {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Pill className="w-5 h-5 text-primary" />
        Medication Manager
      </h2>

      <Tabs defaultValue="today" className="w-full">
        <TabsList className="w-full grid grid-cols-5">
          <TabsTrigger value="today" className="text-xs gap-1">
            <CalendarDays className="w-3 h-3" /> Today
          </TabsTrigger>
          <TabsTrigger value="meds" className="text-xs gap-1">
            <Pill className="w-3 h-3" /> My Meds
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

        <TabsContent value="today"><TodaySchedule /></TabsContent>
        <TabsContent value="meds"><MedicationList /></TabsContent>
        <TabsContent value="refill"><RefillOrder /></TabsContent>
        <TabsContent value="banned"><BannedMedications /></TabsContent>
        <TabsContent value="alarms"><AlarmSettings /></TabsContent>
      </Tabs>
    </div>
  );
};

export default MedicationManager;

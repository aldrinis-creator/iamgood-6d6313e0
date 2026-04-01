import { useGuardianWard } from "@/contexts/GuardianWardContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users } from "lucide-react";

const WardPicker = () => {
  const { wards, selectedWard, setSelectedWard } = useGuardianWard();

  if (wards.length < 2) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-lg">
      <Users className="w-4 h-4 text-primary shrink-0" />
      <Select
        value={selectedWard?.userId || ""}
        onValueChange={(uid) => {
          const ward = wards.find((w) => w.userId === uid);
          if (ward) setSelectedWard(ward);
        }}
      >
        <SelectTrigger className="min-h-[36px] text-sm border-0 bg-transparent shadow-none px-1">
          <SelectValue placeholder="Select ward" />
        </SelectTrigger>
        <SelectContent>
          {wards.map((w) => (
            <SelectItem key={w.userId} value={w.userId}>
              {w.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default WardPicker;

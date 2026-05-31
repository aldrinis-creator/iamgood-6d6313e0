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
      {selectedWard?.avatarUrl ? (
        <div className="w-5 h-5 rounded-full overflow-hidden shrink-0 shadow-sm border border-border">
          <img src={selectedWard.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
        </div>
      ) : (
        <Users className="w-4 h-4 text-primary shrink-0" />
      )}
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
              <div className="flex items-center gap-2">
                {w.avatarUrl ? (
                  <img src={w.avatarUrl} className="w-4 h-4 rounded-full object-cover" alt="" />
                ) : (
                  <Users className="w-3 h-3 text-muted-foreground" />
                )}
                {w.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default WardPicker;

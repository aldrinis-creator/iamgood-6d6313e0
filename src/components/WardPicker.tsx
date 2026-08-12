import { useGuardianWard } from "@/contexts/GuardianWardContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users } from "lucide-react";
import AvatarImage from "@/components/AvatarImage";


const WardPicker = () => {
  const { wards, selectedWard, setSelectedWard } = useGuardianWard();

  if (wards.length < 2) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-lg">
      <div className="w-5 h-5 rounded-full overflow-hidden shrink-0 flex items-center justify-center">
        <AvatarImage
          value={selectedWard?.avatarUrl}
          className="w-full h-full object-cover"
          fallback={<Users className="w-4 h-4 text-primary shrink-0" />}
        />
      </div>

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
                <AvatarImage
                  value={w.avatarUrl}
                  className="w-4 h-4 rounded-full object-cover"
                  fallback={<Users className="w-3 h-3 text-muted-foreground" />}
                />

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

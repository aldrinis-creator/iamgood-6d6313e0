import { Button } from "@/components/ui/button";
import { BLOOD_GROUPS, type BloodGroup } from "@/lib/bloodBanks";
import { cn } from "@/lib/utils";

interface Props {
  value: BloodGroup | null;
  onChange: (v: BloodGroup) => void;
}

const BloodGroupGrid = ({ value, onChange }: Props) => {
  return (
    <div className="grid grid-cols-4 gap-2">
      {BLOOD_GROUPS.map((g) => {
        const active = g === value;
        return (
          <Button
            key={g}
            type="button"
            variant={active ? "default" : "outline"}
            onClick={() => onChange(g)}
            className={cn(
              "h-14 text-lg font-bold",
              active && "bg-red-600 hover:bg-red-700 text-white border-red-600",
            )}
          >
            {g}
          </Button>
        );
      })}
    </div>
  );
};

export default BloodGroupGrid;

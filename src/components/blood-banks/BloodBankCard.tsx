import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Navigation, MapPin } from "lucide-react";
import { directionsUrl, type BloodBankWithDistance } from "@/lib/bloodBanks";

interface Props {
  bank: BloodBankWithDistance;
}

const BloodBankCard = ({ bank }: Props) => {
  const km = bank.distance_km;
  const distLabel = km < 1 ? `${Math.round(km * 1000)} m away` : `${km.toFixed(1)} km away`;
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold leading-tight">{bank.name}</p>
            {bank.address && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{bank.address}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {distLabel}
              {bank.district ? ` • ${bank.district}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-700 dark:text-yellow-500 font-medium">
            🟡 Call to Verify
          </span>
          {bank.category && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {bank.category}
            </span>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={!bank.phone}
            onClick={() => bank.phone && window.open(`tel:${bank.phone}`)}
          >
            <Phone className="w-3.5 h-3.5" />
            {bank.phone ? "Call Blood Bank" : "No phone"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-1.5"
            onClick={() => window.open(directionsUrl(bank), "_blank")}
          >
            <Navigation className="w-3.5 h-3.5" />
            Directions
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default BloodBankCard;

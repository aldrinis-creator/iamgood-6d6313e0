import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Hospital, Cross, Phone, MapPin, Shield, Flame, Baby, Brain, FlaskConical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import NearbyFacilities from "@/components/NearbyFacilities";

const EMERGENCY_NUMBERS = [
  { label: "Police", phone: "100", icon: Shield },
  { label: "Ambulance", phone: "108", icon: Hospital },
  { label: "Fire", phone: "101", icon: Flame },
  { label: "Women Helpline", phone: "1091", icon: Phone },
  { label: "Child Helpline", phone: "1098", icon: Baby },
  { label: "Mental Health (iCall)", phone: "9152987821", icon: Brain },
  { label: "Poison Control", phone: "1800116117", icon: FlaskConical },
];

const HealthServices = () => {
  const { user } = useAuth();
  const [facilityView, setFacilityView] = useState<"hospitals" | "pharmacies" | null>(null);

  const { data: guardians = [] } = useQuery({
    queryKey: ["guardians", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("guardians")
        .select("id, guardian_name, guardian_phone, relation, is_primary")
        .eq("user_id", user!.id)
        .order("is_primary", { ascending: false });
      return data || [];
    },
  });

  // Show in-app map view
  if (facilityView) {
    return <NearbyFacilities type={facilityView} onBack={() => setFacilityView(null)} />;
  }

  return (
    <div className="space-y-4">
      {/* Nearby Facilities */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Find Nearby</h2>
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col gap-2"
            onClick={() => setFacilityView("hospitals")}
          >
            <Hospital className="w-6 h-6 text-primary" />
            <span className="text-xs font-medium">Hospitals</span>
            <MapPin className="w-3 h-3 text-muted-foreground" />
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col gap-2"
            onClick={() => setFacilityView("pharmacies")}
          >
            <Cross className="w-6 h-6 text-success" />
            <span className="text-xs font-medium">Pharmacies</span>
            <MapPin className="w-3 h-3 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Emergency Directory */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Emergency Directory</h2>
        <Card>
          <CardContent className="p-0 divide-y divide-border">
            {EMERGENCY_NUMBERS.map((item) => (
              <a
                key={item.phone}
                href={`tel:${item.phone}`}
                className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-sos/10 flex items-center justify-center shrink-0">
                  <item.icon className="w-4 h-4 text-sos" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.phone}</p>
                </div>
                <Phone className="w-4 h-4 text-primary" />
              </a>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Personal Contacts */}
      {guardians.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-2">My Emergency Contacts</h2>
          <Card>
            <CardContent className="p-0 divide-y divide-border">
              {guardians.map((g) => (
                <a
                  key={g.id}
                  href={`tel:${g.guardian_phone}`}
                  className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{g.guardian_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.relation && `${g.relation} • `}{g.guardian_phone}
                    </p>
                  </div>
                  {g.is_primary && (
                    <span className="text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full">Primary</span>
                  )}
                  <Phone className="w-4 h-4 text-success" />
                </a>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      <p className="text-xs text-center text-muted-foreground">
        <MapPin className="w-3 h-3 inline mr-1" />
        Location is used only to find nearby facilities and is not stored.
      </p>
    </div>
  );
};

export default HealthServices;

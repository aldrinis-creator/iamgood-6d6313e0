import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { Loader2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "hospitals" | "pharmacies" | "janaushadhi";
  userPos: { lat: number; lon: number } | null;
  onAdded: () => void;
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

const AddFacilityDialog = ({ open, onOpenChange, type, userPos, onAdded }: Props) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);

  // Structured address fields for Jan Aushadhi
  const [pincode, setPincode] = useState("");
  const [roadName, setRoadName] = useState("");
  const [area, setArea] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  const isJanAushadhi = type === "janaushadhi";
  const facilityType = type === "hospitals" ? "hospital" : type === "janaushadhi" ? "janaushadhi" : "pharmacy";

  const geocodeAddress = async (addr?: string) => {
    const query = addr || address;
    if (!query.trim()) return;
    setGeocoding(true);
    try {
      const res = await fetch(
        `${NOMINATIM_URL}?format=json&q=${encodeURIComponent(query)}&limit=1`,
        { headers: { "User-Agent": "CheckiN-App/1.0" } }
      );
      const data = await res.json();
      if (data.length > 0) {
        setCoords({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) });
        toast.success("Location found");
      } else {
        toast.error("Address not found. Try a more specific address.");
      }
    } catch {
      toast.error("Geocoding failed. Please try again.");
    } finally {
      setGeocoding(false);
    }
  };

  const geocodeStructured = () => {
    if (!pincode.trim() || !city.trim()) {
      toast.error("Pincode and City are required to find location");
      return;
    }
    const query = `${pincode}, ${city}, India`;
    geocodeAddress(query);
  };

  const useCurrentLocation = () => {
    if (userPos) {
      setCoords(userPos);
      toast.success("Using your current location");
    } else {
      toast.error("Location not available");
    }
  };

  const buildStructuredAddress = () => {
    const parts = [roadName.trim(), area.trim(), city.trim(), state.trim(), pincode.trim()].filter(Boolean);
    return parts.join(", ");
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }

    if (isJanAushadhi) {
      if (!pincode.trim()) { toast.error("Pincode is required"); return; }
      if (!roadName.trim()) { toast.error("Road Name/Number is required"); return; }
      if (!area.trim()) { toast.error("Area is required"); return; }
      if (!city.trim()) { toast.error("City is required"); return; }
    }

    if (!coords) { toast.error("Please set a location first"); return; }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Please sign in"); return; }

      const finalAddress = isJanAushadhi ? buildStructuredAddress() : (address.trim() || null);

      const { error } = await supabase.from("user_facilities" as any).insert({
        user_id: user.id,
        facility_type: facilityType,
        name: name.trim(),
        lat: coords.lat,
        lon: coords.lon,
        phone: phone.trim() || null,
        address: finalAddress,
      });

      if (error) throw error;
      toast.success(`${isJanAushadhi ? "Jan Aushadhi Kendra" : facilityType === "hospital" ? "Hospital" : "Pharmacy"} added`);
      setName(""); setPhone(""); setAddress(""); setCoords(null);
      setPincode(""); setRoadName(""); setArea(""); setCity(""); setState("");
      onOpenChange(false);
      onAdded();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const isFormValid = isJanAushadhi
    ? name.trim() && pincode.trim() && roadName.trim() && area.trim() && city.trim() && coords
    : name.trim() && coords;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add {isJanAushadhi ? "Jan Aushadhi Kendra" : facilityType === "hospital" ? "Hospital" : "Pharmacy"}</DialogTitle>
          <DialogDescription>Add a facility that others can also discover.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="fac-name">{isJanAushadhi ? "Shop Name" : "Name"} *</Label>
            <Input id="fac-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={isJanAushadhi ? "e.g. Jan Aushadhi Kendra #123" : "e.g. City General Hospital"} />
          </div>
          <div>
            <Label htmlFor="fac-phone">Phone</Label>
            <Input id="fac-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
          </div>

          {isJanAushadhi ? (
            <>
              <div>
                <Label htmlFor="fac-pincode">Pincode *</Label>
                <Input id="fac-pincode" value={pincode} onChange={(e) => { setPincode(e.target.value); setCoords(null); }} placeholder="e.g. 400001" maxLength={6} />
              </div>
              <div>
                <Label htmlFor="fac-road">Road Name / Number *</Label>
                <Input id="fac-road" value={roadName} onChange={(e) => setRoadName(e.target.value)} placeholder="e.g. MG Road" />
              </div>
              <div>
                <Label htmlFor="fac-area">Area *</Label>
                <Input id="fac-area" value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Fort" />
              </div>
              <div>
                <Label htmlFor="fac-city">City *</Label>
                <Input id="fac-city" value={city} onChange={(e) => { setCity(e.target.value); setCoords(null); }} placeholder="e.g. Mumbai" />
              </div>
              <div>
                <Label htmlFor="fac-state">State</Label>
                <Input id="fac-state" value={state} onChange={(e) => setState(e.target.value)} placeholder="e.g. Maharashtra" />
              </div>
              <Button size="sm" variant="outline" onClick={geocodeStructured} disabled={geocoding || !pincode.trim() || !city.trim()} className="w-full">
                {geocoding ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <MapPin className="w-4 h-4 mr-1" />}
                Find Location from Pincode
              </Button>
            </>
          ) : (
            <div>
              <Label htmlFor="fac-address">Address</Label>
              <div className="flex gap-2">
                <Input
                  id="fac-address"
                  value={address}
                  onChange={(e) => { setAddress(e.target.value); setCoords(null); }}
                  placeholder="Enter address…"
                  className="flex-1"
                />
                <Button size="sm" variant="outline" onClick={() => geocodeAddress()} disabled={geocoding || !address.trim()} className="shrink-0">
                  {geocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Find"}
                </Button>
              </div>
            </div>
          )}

          <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={useCurrentLocation}>
            <MapPin className="w-3 h-3" /> Use current location
          </Button>
          {coords && (
            <p className="text-xs text-success flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Location set: {coords.lat.toFixed(4)}, {coords.lon.toFixed(4)}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={saving || !isFormValid}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddFacilityDialog;

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

  const facilityType = type === "hospitals" ? "hospital" : "pharmacy";

  const geocodeAddress = async () => {
    if (!address.trim()) return;
    setGeocoding(true);
    try {
      const res = await fetch(
        `${NOMINATIM_URL}?format=json&q=${encodeURIComponent(address)}&limit=1`,
        { headers: { "User-Agent": "CheckiN-App/1.0" } }
      );
      const data = await res.json();
      if (data.length > 0) {
        setCoords({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) });
        if (!address.includes(data[0].display_name?.split(",")[0])) {
          setAddress(data[0].display_name || address);
        }
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

  const useCurrentLocation = () => {
    if (userPos) {
      setCoords(userPos);
      setAddress("Current location");
      toast.success("Using your current location");
    } else {
      toast.error("Location not available");
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    if (!coords) { toast.error("Please set a location first"); return; }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Please sign in"); return; }

      const { error } = await supabase.from("user_facilities" as any).insert({
        user_id: user.id,
        facility_type: facilityType,
        name: name.trim(),
        lat: coords.lat,
        lon: coords.lon,
        phone: phone.trim() || null,
        address: address.trim() || null,
      });

      if (error) throw error;
      toast.success(`${facilityType === "hospital" ? "Hospital" : "Pharmacy"} added`);
      setName(""); setPhone(""); setAddress(""); setCoords(null);
      onOpenChange(false);
      onAdded();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add {facilityType === "hospital" ? "Hospital" : "Pharmacy"}</DialogTitle>
          <DialogDescription>Add a facility that others can also discover.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="fac-name">Name *</Label>
            <Input id="fac-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. City General Hospital" />
          </div>
          <div>
            <Label htmlFor="fac-phone">Phone</Label>
            <Input id="fac-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
          </div>
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
              <Button size="sm" variant="outline" onClick={geocodeAddress} disabled={geocoding || !address.trim()} className="shrink-0">
                {geocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Find"}
              </Button>
            </div>
          </div>
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
          <Button onClick={handleSave} disabled={saving || !name.trim() || !coords}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddFacilityDialog;

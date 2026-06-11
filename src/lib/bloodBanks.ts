import { haversineDistance } from "./haversine";

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

export const BLOOD_COMPONENTS = ["Whole Blood", "Platelets", "Plasma"] as const;
export type BloodComponent = (typeof BLOOD_COMPONENTS)[number];

export interface BloodBank {
  id: string;
  name: string;
  address: string | null;
  district: string | null;
  state: string | null;
  category: string | null;
  phone: string | null;
  email: string | null;
  lat: number | null;
  lng: number | null;
  geocode_status: "pending" | "ok" | "centroid" | "failed";
}

export interface BloodBankWithDistance extends BloodBank {
  distance_km: number;
}

/** Clean placeholder values (the source CSV uses "-" for missing phone/email). */
export const cleanField = (v: string | null | undefined): string | null => {
  if (!v) return null;
  const t = v.trim();
  if (!t || t === "-" || t === "--") return null;
  return t;
};

/** Sort banks by Haversine distance from origin and return the top N. */
export function nearestBanks(
  banks: BloodBank[],
  origin: { lat: number; lng: number },
  limit = 5,
): BloodBankWithDistance[] {
  return banks
    .filter((b) => typeof b.lat === "number" && typeof b.lng === "number")
    .map((b) => ({
      ...b,
      distance_km: haversineDistance(origin.lat, origin.lng, b.lat!, b.lng!) / 1000,
    }))
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, limit);
}

/** Build a Google Maps directions URL to a destination. */
export function directionsUrl(b: BloodBank): string {
  if (b.lat != null && b.lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}`;
  }
  const q = encodeURIComponent([b.name, b.address, b.district, b.state].filter(Boolean).join(", "));
  return `https://www.google.com/maps/dir/?api=1&destination=${q}`;
}

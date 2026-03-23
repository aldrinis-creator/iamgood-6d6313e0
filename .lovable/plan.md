

# Worldwide Hospital/Pharmacy Search + User-Added Facilities

## Current State

The search **already works worldwide**. It uses the OpenStreetMap Overpass API with the user's GPS coordinates and a 5km radius. It works anywhere OSM has data — which is global, though coverage varies by region.

The limitation is that the max distance slider only goes up to 5km. In areas with sparse OSM data, this may return zero results.

## Changes

### 1. Expand search radius and add manual location entry
**File:** `src/components/NearbyFacilities.tsx`

- Increase max distance slider from 5km to 25km (step 1km after 5km)
- Add a "Search by address" input that uses the free Nominatim geocoder API (`https://nominatim.openstreetmap.org/search`) to let users search any location worldwide, not just their current GPS position
- When a user enters an address, geocode it and re-fetch facilities around that location
- Update the map center and "You are here" marker to the searched location

### 2. Add "Add a facility" feature
**File:** `src/components/NearbyFacilities.tsx`

- Add a "+" button in the header to open an "Add Facility" dialog
- Dialog fields: Name, Phone (optional), Address or "Use current location" / "Pick on map"
- For address input, geocode via Nominatim to get lat/lon
- Save to a new `user_facilities` database table
- User-added facilities appear in the list with a "User added" badge and are merged with Overpass results

### 3. Database: `user_facilities` table
New migration with columns:
- `id` (uuid, PK)
- `user_id` (uuid, NOT NULL)
- `facility_type` (text — "hospital" or "pharmacy")
- `name` (text, NOT NULL)
- `lat` (double precision, NOT NULL)
- `lon` (double precision, NOT NULL)
- `phone` (text, nullable)
- `address` (text, nullable)
- `created_at` (timestamptz)

RLS: Users can CRUD own entries. Guardians can SELECT ward entries.

### 4. Wire user facilities into search results
- After fetching Overpass results, also fetch `user_facilities` for the current user filtered by type
- Merge and sort by distance
- User-added facilities show a distinct badge and can be edited/deleted

## Technical Details
- Nominatim geocoder is free, no API key needed (respect usage policy with 1 req/sec)
- No new edge functions needed
- Dialog uses existing `Dialog` + `Form` UI components

## Files Changed
- `src/components/NearbyFacilities.tsx` — expand radius, add address search, merge user facilities, add facility dialog
- New migration SQL — `user_facilities` table + RLS

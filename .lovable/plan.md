

# Jan Aushadhi Integration Plan — Affordable Medicines + Store Locator

## Context

Jan Aushadhi Kendras (PMBJP scheme) offer 2400+ generic medicines at 50-90% discount over branded equivalents. There is no public REST API — data comes from pmbi.co.in (product list) and janaushadhi.gov.in (store locator). Both sites use server-rendered pages, not APIs.

## Strategy

Since there is no official API, we use a **two-pronged approach**:

1. **Medicine database** — Seed a Supabase table with the PMBI product catalog (~2400 items, available as downloadable PDF/Excel from pmbi.co.in). This table is searched client-side to show generic alternatives and Jan Aushadhi prices alongside the user's branded medications.

2. **Store locator** — Use OpenStreetMap Overpass (already in the app) with the tag `name~"Jan Aushadhi"` OR `operator~"PMBJP"` to find nearby Kendras. Fallback: maintain a curated list in a `jan_aushadhi_stores` table seeded from the government's district-wise Kendra list.

## Integration Points (User-Facing)

### A. In Medication Manager (Refill tab)
When a user views their medication list or builds a refill order, each medication shows:
- **Jan Aushadhi equivalent** with generic name, dosage, and MRP
- **Savings badge**: "Save ₹XX (YY%)" comparing branded vs Jan Aushadhi price
- **"Order from Jan Aushadhi"** button that locates the nearest Kendra and generates a WhatsApp order

### B. In Health Services
Add a third tile: **"Jan Aushadhi Kendras"** alongside Hospitals and Pharmacies, opening the NearbyFacilities map filtered for Jan Aushadhi stores.

### C. Standalone Search (optional later)
A search bar in the Medication Info tool to look up any medicine's Jan Aushadhi equivalent.

---

## Technical Plan

### 1. Database Migration — Two new tables

**`jan_aushadhi_products`** (~2400 rows, seeded once, updated periodically)

| Column | Type | Description |
|---|---|---|
| id | uuid PK | |
| drug_code | text | PMBI drug code |
| generic_name | text | Generic medicine name |
| unit_size | text | e.g. "10's", "100ml" |
| mrp | numeric | Jan Aushadhi MRP in ₹ |
| category | text | e.g. "Cardiovascular", "GIT" |
| salt_composition | text | Active ingredients |

**`jan_aushadhi_stores`** (seeded from government list, ~12000 rows)

| Column | Type | Description |
|---|---|---|
| id | uuid PK | |
| store_name | text | |
| state | text | |
| district | text | |
| address | text | |
| pincode | text | |
| phone | text | |
| lat | double precision | Geocoded |
| lon | double precision | Geocoded |

Both tables: RLS open for SELECT to authenticated users (public data), no INSERT/UPDATE/DELETE for regular users.

### 2. Edge Function — `jan-aushadhi-search`

- **Input**: `{ type: "product_search" | "store_search", query: string, lat?: number, lon?: number }`
- **Product search**: Fuzzy match on `generic_name` or `salt_composition` against user's medication name. Returns top matches with MRP and savings estimate.
- **Store search**: Query `jan_aushadhi_stores` by proximity (lat/lon + haversine) or by pincode/district.
- Uses AI (Lovable AI) to map branded medicine names to generic salt compositions for better matching.

### 3. Refill Order Enhancement — `RefillOrder.tsx`

- After loading user's medications, call `jan-aushadhi-search` for each medication name
- Show a green card per medication with Jan Aushadhi match:
  ```text
  ┌──────────────────────────────────┐
  │ 💊 Paracetamol 500mg (10's)     │
  │ Jan Aushadhi MRP: ₹3.00         │
  │ Branded price: ~₹15             │
  │ 🏷️ Save up to 80%              │
  │ [Find Nearest Kendra] [Order]   │
  └──────────────────────────────────┘
  ```
- "Order" adds to existing WhatsApp order flow but pre-fills the nearest Jan Aushadhi Kendra's number
- "Find Nearest Kendra" opens NearbyFacilities map filtered for Jan Aushadhi

### 4. Health Services Update — `HealthServices.tsx`

- Add a third button in the "Find Nearby" grid: **"Jan Aushadhi"** with a government-green color
- Clicking opens `NearbyFacilities` with `type="janaushadhi"`

### 5. NearbyFacilities Enhancement — `NearbyFacilities.tsx`

- Extend the `type` prop to accept `"janaushadhi"`
- For this type, query both Overpass (OSM tag `name~"Jan Aushadhi"`) AND the `jan_aushadhi_stores` table
- Merge results, deduplicate by proximity, show on map

### 6. Data Seeding Script

- A one-time edge function or migration that seeds the `jan_aushadhi_products` table from a curated CSV/JSON (extracted from the PMBI PDF list)
- Store data can be seeded similarly from the government's district-wise Excel
- Include a note for periodic refresh (quarterly)

---

## Files Changed

- **Migration SQL** — create `jan_aushadhi_products` and `jan_aushadhi_stores` tables with RLS
- **`supabase/functions/jan-aushadhi-search/index.ts`** — new edge function for product + store search
- **`src/components/medications/RefillOrder.tsx`** — add Jan Aushadhi alternative cards with savings
- **`src/components/HealthServices.tsx`** — add Jan Aushadhi Kendra tile
- **`src/components/NearbyFacilities.tsx`** — support `"janaushadhi"` type
- **Seed data** — initial product catalog and store locations (via migration INSERT or edge function)

## Data Sourcing Note

The PMBI product list (2400+ items) and Kendra locations (12000+ stores) are publicly available government data. The initial seed will be a curated extract. A quarterly refresh mechanism can be added later as an admin edge function.


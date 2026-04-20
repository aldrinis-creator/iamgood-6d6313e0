

## Yes — fully possible, no API key change needed

The AQI widget already uses **Open-Meteo** (free, no key) for temperature. The same single endpoint can return UV, precipitation, and humidity by just adding parameters to the query — zero new integrations, zero cost, no rate-limit risk.

## Approach

### 1. Extend the Open-Meteo call in `src/components/AQIWidget.tsx`

Current call:
```
?latitude=..&longitude=..&current_weather=true
```

New call (single request, same endpoint):
```
?latitude=..&longitude=..
 &current=temperature_2m,relative_humidity_2m,precipitation,uv_index,weather_code
 &timezone=auto
```

This returns:
- `temperature_2m` (°C) — replaces existing `current_weather.temperature`
- `relative_humidity_2m` (%)
- `precipitation` (mm, last hour)
- `uv_index` (0–11+ scale)

### 2. Extend `AQIData` interface

Add: `humidity?: number`, `precipitation?: number`, `uvIndex?: number`.

### 3. UI — popover layout

Add a compact **"Weather"** strip between the existing main readout (AQI circle + temp) and the "Seniors Advisory" section. Four small stat tiles in a 2×2 or 4-col grid:

```
┌──────────┬──────────┬──────────┬──────────┐
│ 🌡 28°C  │ 💧 65%   │ ☂ 0.2mm  │ ☀ UV 7   │
│  Temp    │ Humidity │  Rain    │  High    │
└──────────┴──────────┴──────────┴──────────┘
```

- Icons: `Thermometer`, `Droplets`, `CloudRain`, `Sun` (all lucide-react, already in stack)
- UV color coding: green (0–2 Low), yellow (3–5 Moderate), orange (6–7 High), red (8–10 Very High), purple (11+ Extreme)
- Humidity color hint for elderly: amber if <30% (dry, respiratory risk) or >70% (heat stress)

The existing temperature pill in the trigger button stays as-is (compact mobile view).

### 4. Optional — senior-friendly advisory line

If `uv_index >= 6` OR `humidity >= 70` OR `precipitation > 0.5`, append a one-line tip below the existing "Seniors Advisory" (or as its own muted line if no AQI advisory present):

- UV ≥ 6: "High UV — wear hat & sunscreen if going out"
- Humidity ≥ 70: "Humid conditions — stay hydrated"
- Rain > 0.5mm: "Light rain — slippery surfaces, walk with care"

Keeps the elderly-care theme consistent with the existing AQI advisory.

## Files to edit

- `src/components/AQIWidget.tsx` — single file change (extend fetch, extend interface, add weather strip + optional advisory)

## Out of scope

- Hourly/daily forecast (would need a bigger UI rework)
- Pollen, wind speed, visibility (easy to add later if requested)
- Caching weather data (current 10-min inactivity revert already handles freshness)
- Search results — when user searches a location, weather params will also load for that location automatically (free benefit)


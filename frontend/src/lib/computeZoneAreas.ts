import { area } from "@turf/turf";
import type { ZoneResult } from "./computeZoneRings";

export interface ZoneArea {
  zoneLabel: string;
  distanceBand: string;
  areaSqFt: number;
}

const ZONE_META = [
  { key: "zone1" as const, zoneLabel: "Zone 1", distanceBand: "0–5 ft" },
  { key: "zone2" as const, zoneLabel: "Zone 2", distanceBand: "5–10 ft" },
  { key: "zone3" as const, zoneLabel: "Zone 3", distanceBand: "10–30 ft" },
  { key: "zone4" as const, zoneLabel: "Zone 4", distanceBand: "30–100 ft" },
] as const;

const SQ_M_TO_SQ_FT = 10.7639;

export function computeZoneAreas(zones: ZoneResult): ZoneArea[] {
  return ZONE_META.map(({ key, zoneLabel, distanceBand }) => {
    const areaSqM = area(zones[key]);
    const areaSqFt = Math.round(areaSqM * SQ_M_TO_SQ_FT);
    return { zoneLabel, distanceBand, areaSqFt };
  });
}

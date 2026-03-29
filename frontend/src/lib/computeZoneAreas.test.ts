import { describe, it, expect } from "vitest";
import { featureCollection, polygon } from "@turf/turf";
import type { FeatureCollection, Polygon, MultiPolygon } from "geojson";
import { computeZoneRings } from "./computeZoneRings";
import { computeZoneAreas } from "./computeZoneAreas";

/** Small square building polygon near Ashland, OR */
const building = polygon([
  [
    [-122.71, 42.19],
    [-122.7099, 42.19],
    [-122.7099, 42.1901],
    [-122.71, 42.1901],
    [-122.71, 42.19],
  ],
]);

const buildings: FeatureCollection<Polygon | MultiPolygon> =
  featureCollection([building]);

const zones = computeZoneRings(buildings);

describe("computeZoneAreas", () => {
  it("returns 4 zone entries with correct labels and bands", () => {
    const result = computeZoneAreas(zones);

    expect(result).toHaveLength(4);

    expect(result[0]!.zoneLabel).toBe("Zone 1");
    expect(result[0]!.distanceBand).toBe("0–5 ft");

    expect(result[1]!.zoneLabel).toBe("Zone 2");
    expect(result[1]!.distanceBand).toBe("5–10 ft");

    expect(result[2]!.zoneLabel).toBe("Zone 3");
    expect(result[2]!.distanceBand).toBe("10–30 ft");

    expect(result[3]!.zoneLabel).toBe("Zone 4");
    expect(result[3]!.distanceBand).toBe("30–100 ft");
  });

  it("returns 0 area for empty FeatureCollections", () => {
    const emptyZones = computeZoneRings(featureCollection([]));
    const result = computeZoneAreas(emptyZones);

    expect(result).toHaveLength(4);
    for (const entry of result) {
      expect(entry.areaSqFt).toBe(0);
    }
  });

  it("outer zones have larger areas than inner zones", () => {
    const result = computeZoneAreas(zones);

    const [zone1, zone2, zone3, zone4] = result;

    expect(zone2!.areaSqFt).toBeGreaterThan(zone1!.areaSqFt);
    expect(zone3!.areaSqFt).toBeGreaterThan(zone2!.areaSqFt);
    expect(zone4!.areaSqFt).toBeGreaterThan(zone3!.areaSqFt);
  });

  it("areas are positive for non-empty zones", () => {
    const result = computeZoneAreas(zones);

    for (const entry of result) {
      expect(entry.areaSqFt).toBeGreaterThan(0);
    }
  });
});

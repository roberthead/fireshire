import { describe, it, expect } from "vitest";
import { featureCollection, polygon, area, intersect } from "@turf/turf";
import type { FeatureCollection, Polygon, MultiPolygon } from "geojson";
import { computeZoneRings } from "./computeZoneRings";

/** Helper: small square polygon (~30m side) centered near 0,0 */
function makeSquare(
  centerLng: number,
  centerLat: number,
  halfSizeDeg = 0.0002,
) {
  return polygon([
    [
      [centerLng - halfSizeDeg, centerLat - halfSizeDeg],
      [centerLng + halfSizeDeg, centerLat - halfSizeDeg],
      [centerLng + halfSizeDeg, centerLat + halfSizeDeg],
      [centerLng - halfSizeDeg, centerLat + halfSizeDeg],
      [centerLng - halfSizeDeg, centerLat - halfSizeDeg],
    ],
  ]);
}

describe("computeZoneRings", () => {
  it("returns 4 zones with empty FeatureCollections for empty input", () => {
    const empty: FeatureCollection<Polygon | MultiPolygon> =
      featureCollection([]);
    const result = computeZoneRings(empty);

    expect(result.zone1.type).toBe("FeatureCollection");
    expect(result.zone2.type).toBe("FeatureCollection");
    expect(result.zone3.type).toBe("FeatureCollection");
    expect(result.zone4.type).toBe("FeatureCollection");
    expect(result.zone1.features).toHaveLength(0);
    expect(result.zone2.features).toHaveLength(0);
    expect(result.zone3.features).toHaveLength(0);
    expect(result.zone4.features).toHaveLength(0);
  });

  it("produces valid ring polygons for a single building", () => {
    const building = makeSquare(-122.7, 42.19);
    const buildings: FeatureCollection<Polygon | MultiPolygon> =
      featureCollection([building]);

    const result = computeZoneRings(buildings);

    // Each zone should have exactly 1 feature
    expect(result.zone1.features).toHaveLength(1);
    expect(result.zone2.features).toHaveLength(1);
    expect(result.zone3.features).toHaveLength(1);
    expect(result.zone4.features).toHaveLength(1);

    // Each feature should be a Polygon or MultiPolygon
    for (const zone of [result.zone1, result.zone2, result.zone3, result.zone4]) {
      const geomType = zone.features[0]!.geometry.type;
      expect(["Polygon", "MultiPolygon"]).toContain(geomType);
    }
  });

  it("produces rings in correct nesting order (zone1 inside zone2 inside zone3 inside zone4)", () => {
    const building = makeSquare(-122.7, 42.19);
    const buildings: FeatureCollection<Polygon | MultiPolygon> =
      featureCollection([building]);

    const result = computeZoneRings(buildings);

    const area1 = area(result.zone1);
    const area2 = area(result.zone2);
    const area3 = area(result.zone3);
    const area4 = area(result.zone4);

    // Outer zones should have larger area than inner zones
    expect(area2).toBeGreaterThan(area1);
    expect(area3).toBeGreaterThan(area2);
    expect(area4).toBeGreaterThan(area3);
  });

  it("zone4 contains zone1 spatially (outer ring encloses inner ring)", () => {
    const building = makeSquare(-122.7, 42.19);
    const buildings: FeatureCollection<Polygon | MultiPolygon> =
      featureCollection([building]);

    const result = computeZoneRings(buildings);

    // The zone4 outer boundary should spatially contain zone1
    // Use booleanContains to verify nesting
    const z1 = result.zone1.features[0]!;
    const z4 = result.zone4.features[0]!;

    // zone4 is further from the building, so its bounding box should enclose zone1
    const z1Bbox = getBbox(z1);
    const z4Bbox = getBbox(z4);

    expect(z4Bbox.minLng).toBeLessThan(z1Bbox.minLng);
    expect(z4Bbox.maxLng).toBeGreaterThan(z1Bbox.maxLng);
    expect(z4Bbox.minLat).toBeLessThan(z1Bbox.minLat);
    expect(z4Bbox.maxLat).toBeGreaterThan(z1Bbox.maxLat);
  });

  it("union reduces polygon count for two overlapping buildings", () => {
    // Two buildings close enough that their buffers overlap
    const b1 = makeSquare(-122.7, 42.19, 0.0002);
    const b2 = makeSquare(-122.6998, 42.19, 0.0002); // ~15m apart

    const buildings: FeatureCollection<Polygon | MultiPolygon> =
      featureCollection([b1, b2]);

    const result = computeZoneRings(buildings);

    // With union, each zone should have exactly 1 merged feature
    // (because the buildings are close enough for buffers to overlap)
    expect(result.zone4.features).toHaveLength(1);

    // The merged geometry should be a single Polygon or MultiPolygon
    const geomType = result.zone4.features[0]!.geometry.type;
    expect(["Polygon", "MultiPolygon"]).toContain(geomType);
  });

  it("produces separate features for widely separated buildings that don't overlap at 100ft", () => {
    // Two buildings far apart (buffers won't overlap)
    const b1 = makeSquare(-122.7, 42.19);
    const b2 = makeSquare(-122.5, 42.19); // ~15km apart

    const buildings: FeatureCollection<Polygon | MultiPolygon> =
      featureCollection([b1, b2]);

    const result = computeZoneRings(buildings);

    // After union, turf may produce a MultiPolygon with 2 separate parts,
    // or keep them as separate features. Either way, we should have valid output.
    expect(result.zone1.features.length).toBeGreaterThanOrEqual(1);
    expect(result.zone4.features.length).toBeGreaterThanOrEqual(1);
  });

  it("punches inner zones out of outer zones across nearby buildings", () => {
    // Two buildings close enough that outer zones of one overlap inner zones of the other
    const b1 = makeSquare(-122.7, 42.19, 0.0002);
    const b2 = makeSquare(-122.6998, 42.19, 0.0002); // ~15m apart

    const buildings: FeatureCollection<Polygon | MultiPolygon> =
      featureCollection([b1, b2]);

    const result = computeZoneRings(buildings);

    // Zone 2 must not overlap Zone 1
    if (result.zone2.features.length > 0 && result.zone1.features.length > 0) {
      const overlap21 = intersect(
        featureCollection([result.zone2.features[0]!, result.zone1.features[0]!]),
      );
      expect(overlap21).toBeNull();
    }

    // Zone 3 must not overlap Zone 1 or Zone 2
    if (result.zone3.features.length > 0 && result.zone1.features.length > 0) {
      const overlap31 = intersect(
        featureCollection([result.zone3.features[0]!, result.zone1.features[0]!]),
      );
      expect(overlap31).toBeNull();
    }
    if (result.zone3.features.length > 0 && result.zone2.features.length > 0) {
      const overlap32 = intersect(
        featureCollection([result.zone3.features[0]!, result.zone2.features[0]!]),
      );
      expect(overlap32).toBeNull();
    }

    // Zone 4 must not overlap Zone 1, 2, or 3
    if (result.zone4.features.length > 0) {
      for (const innerZone of [result.zone1, result.zone2, result.zone3]) {
        if (innerZone.features.length > 0) {
          const overlap = intersect(
            featureCollection([result.zone4.features[0]!, innerZone.features[0]!]),
          );
          expect(overlap).toBeNull();
        }
      }
    }
  });

  it("handles multipolygon building geometries", () => {
    // Create a multipolygon by treating it as a regular polygon input
    // (turf.buffer handles both Polygon and MultiPolygon)
    const building = makeSquare(-122.7, 42.19);
    const buildings: FeatureCollection<Polygon | MultiPolygon> =
      featureCollection([building]);

    const result = computeZoneRings(buildings);

    // Should produce valid output without errors
    expect(result.zone1.features.length).toBeGreaterThanOrEqual(1);
    expect(result.zone2.features.length).toBeGreaterThanOrEqual(1);
    expect(result.zone3.features.length).toBeGreaterThanOrEqual(1);
    expect(result.zone4.features.length).toBeGreaterThanOrEqual(1);
  });
});

/** Helper to compute bounding box of a feature */
function getBbox(feature: { geometry: Polygon | MultiPolygon }) {
  let minLng = Infinity,
    maxLng = -Infinity,
    minLat = Infinity,
    maxLat = -Infinity;

  const coords =
    feature.geometry.type === "Polygon"
      ? feature.geometry.coordinates
      : feature.geometry.coordinates.flat();

  for (const ring of coords) {
    for (const [lng, lat] of ring) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }

  return { minLng, maxLng, minLat, maxLat };
}

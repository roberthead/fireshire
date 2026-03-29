import {
  buffer,
  difference,
  union,
  featureCollection,
} from "@turf/turf";
import type {
  FeatureCollection,
  Polygon,
  MultiPolygon,
  Feature,
} from "geojson";

export interface ZoneResult {
  zone1: FeatureCollection<Polygon | MultiPolygon>;
  zone2: FeatureCollection<Polygon | MultiPolygon>;
  zone3: FeatureCollection<Polygon | MultiPolygon>;
  zone4: FeatureCollection<Polygon | MultiPolygon>;
}

/** Zone distance bands in feet */
const ZONE_DISTANCES = [5, 10, 30, 100] as const;

/**
 * Compute concentric zone ring polygons around building footprints.
 *
 * For each building polygon, buffers are computed at 5, 10, 30, and 100 feet.
 * Ring differencing produces donut-shaped zones:
 *   zone1 = buffer(5ft) - building
 *   zone2 = buffer(10ft) - buffer(5ft)
 *   zone3 = buffer(30ft) - buffer(10ft)
 *   zone4 = buffer(100ft) - buffer(30ft)
 *
 * Same-zone rings are unioned across all buildings for clean overlap handling.
 */
export function computeZoneRings(
  buildings: FeatureCollection<Polygon | MultiPolygon>,
): ZoneResult {
  const emptyResult: ZoneResult = {
    zone1: featureCollection([]),
    zone2: featureCollection([]),
    zone3: featureCollection([]),
    zone4: featureCollection([]),
  };

  if (!buildings.features || buildings.features.length === 0) {
    return emptyResult;
  }

  // Accumulate ring features per zone across all buildings
  const zoneRings: [
    Feature<Polygon | MultiPolygon>[],
    Feature<Polygon | MultiPolygon>[],
    Feature<Polygon | MultiPolygon>[],
    Feature<Polygon | MultiPolygon>[],
  ] = [[], [], [], []];

  for (const building of buildings.features) {
    // Compute buffers at each distance
    const buffers = ZONE_DISTANCES.map((dist) =>
      buffer(building, dist, { units: "feet" }),
    );

    // zone1: buffer(5ft) - building footprint
    const ring0 = difference(
      featureCollection([buffers[0]!, building]),
    );
    if (ring0) {
      zoneRings[0].push(ring0 as Feature<Polygon | MultiPolygon>);
    }

    // zone2..4: buffer(n) - buffer(n-1)
    for (let i = 1; i < ZONE_DISTANCES.length; i++) {
      const ring = difference(
        featureCollection([buffers[i]!, buffers[i - 1]!]),
      );
      if (ring) {
        zoneRings[i].push(ring as Feature<Polygon | MultiPolygon>);
      }
    }
  }

  // Union same-zone rings across buildings
  const zones = zoneRings.map((rings) => {
    if (rings.length === 0) {
      return featureCollection([]);
    }
    if (rings.length === 1) {
      return featureCollection(rings);
    }
    const merged = union(featureCollection(rings));
    if (!merged) {
      return featureCollection([]);
    }
    return featureCollection([merged as Feature<Polygon | MultiPolygon>]);
  }) as [
    FeatureCollection<Polygon | MultiPolygon>,
    FeatureCollection<Polygon | MultiPolygon>,
    FeatureCollection<Polygon | MultiPolygon>,
    FeatureCollection<Polygon | MultiPolygon>,
  ];

  // Cross-building subtraction: punch inner zones out of outer zones
  // so that each zone only covers its proper distance band from ALL structures.
  for (let i = 1; i < zones.length; i++) {
    for (let j = 0; j < i; j++) {
      if (zones[i].features.length > 0 && zones[j].features.length > 0) {
        const subtracted = difference(
          featureCollection([zones[i].features[0]!, zones[j].features[0]!]),
        );
        zones[i] = subtracted
          ? featureCollection([subtracted as Feature<Polygon | MultiPolygon>])
          : featureCollection([]);
      }
    }
  }

  return {
    zone1: zones[0],
    zone2: zones[1],
    zone3: zones[2],
    zone4: zones[3],
  };
}

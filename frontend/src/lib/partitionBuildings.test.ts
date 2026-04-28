import { describe, it, expect } from "vitest";
import { featureCollection, polygon } from "@turf/turf";
import type { Feature, Polygon } from "geojson";
import { partitionBuildings } from "./partitionBuildings";

function rectangle(
  west: number,
  south: number,
  east: number,
  north: number,
): Feature<Polygon> {
  return polygon([
    [
      [west, south],
      [east, south],
      [east, north],
      [west, north],
      [west, south],
    ],
  ]);
}

describe("partitionBuildings", () => {
  const parcel = rectangle(-122.71, 42.19, -122.7, 42.2).geometry;

  it("classifies a building inside the parcel as own", () => {
    const inside = rectangle(-122.708, 42.193, -122.706, 42.195);
    const buildings = featureCollection([inside]);

    const { own, adjacent } = partitionBuildings(buildings, parcel);

    expect(own.features).toHaveLength(1);
    expect(adjacent.features).toHaveLength(0);
  });

  it("classifies a building outside the parcel as adjacent", () => {
    const outside = rectangle(-122.69, 42.19, -122.689, 42.191);
    const buildings = featureCollection([outside]);

    const { own, adjacent } = partitionBuildings(buildings, parcel);

    expect(own.features).toHaveLength(0);
    expect(adjacent.features).toHaveLength(1);
  });

  it("treats a building straddling the boundary as own", () => {
    const straddling = rectangle(-122.7005, 42.195, -122.6995, 42.196);
    const buildings = featureCollection([straddling]);

    const { own, adjacent } = partitionBuildings(buildings, parcel);

    expect(own.features).toHaveLength(1);
    expect(adjacent.features).toHaveLength(0);
  });

  it("partitions a mixed set", () => {
    const inside = rectangle(-122.708, 42.193, -122.706, 42.195);
    const outsideA = rectangle(-122.69, 42.19, -122.689, 42.191);
    const outsideB = rectangle(-122.72, 42.18, -122.719, 42.181);
    const buildings = featureCollection([inside, outsideA, outsideB]);

    const { own, adjacent } = partitionBuildings(buildings, parcel);

    expect(own.features).toHaveLength(1);
    expect(adjacent.features).toHaveLength(2);
  });

  it("returns empty collections when input is empty", () => {
    const empty = featureCollection<Polygon>([]);
    const { own, adjacent } = partitionBuildings(empty, parcel);
    expect(own.features).toHaveLength(0);
    expect(adjacent.features).toHaveLength(0);
  });
});

import { booleanIntersects } from "@turf/turf";
import type {
  Feature,
  FeatureCollection,
  MultiPolygon,
  Polygon,
} from "geojson";

type BuildingFeature = Feature<Polygon | MultiPolygon>;
type Buildings = FeatureCollection<Polygon | MultiPolygon>;
type ParcelGeometry = Polygon | MultiPolygon;

export interface PartitionedBuildings {
  own: Buildings;
  adjacent: Buildings;
}

export function partitionBuildings(
  buildings: Buildings,
  parcel: ParcelGeometry,
): PartitionedBuildings {
  const parcelFeature: Feature<ParcelGeometry> = {
    type: "Feature",
    properties: {},
    geometry: parcel,
  };

  const own: BuildingFeature[] = [];
  const adjacent: BuildingFeature[] = [];

  for (const feature of buildings.features) {
    if (booleanIntersects(feature, parcelFeature)) {
      own.push(feature);
    } else {
      adjacent.push(feature);
    }
  }

  return {
    own: { type: "FeatureCollection", features: own },
    adjacent: { type: "FeatureCollection", features: adjacent },
  };
}

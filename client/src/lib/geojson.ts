export type PropertyBoundaryGeoJson = Record<string, unknown>;

const SUPPORTED_GEOMETRY_TYPES = new Set(["Polygon", "MultiPolygon"]);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasSupportedGeometry = (geometry: unknown) => {
  if (!isObject(geometry)) return false;
  const type = geometry.type;
  return typeof type === "string" && SUPPORTED_GEOMETRY_TYPES.has(type);
};

export const isSupportedPropertyGeoJson = (
  value: unknown,
): value is PropertyBoundaryGeoJson => {
  if (!isObject(value) || typeof value.type !== "string") return false;

  if (SUPPORTED_GEOMETRY_TYPES.has(value.type)) {
    return Array.isArray(value.coordinates);
  }

  if (value.type === "Feature") {
    return hasSupportedGeometry(value.geometry);
  }

  if (value.type === "FeatureCollection") {
    if (!Array.isArray(value.features) || value.features.length === 0) return false;
    return value.features.every((feature) => isObject(feature) && feature.type === "Feature" && hasSupportedGeometry(feature.geometry));
  }

  return false;
};

export const parsePropertyBoundaryGeoJson = (
  value: string,
): { geoJson: PropertyBoundaryGeoJson | null; error?: string } => {
  const trimmed = value.trim();
  if (!trimmed) return { geoJson: null };

  try {
    const parsed = JSON.parse(trimmed);
    if (!isSupportedPropertyGeoJson(parsed)) {
      return {
        geoJson: null,
        error: "GeoJSON must be a Polygon, MultiPolygon, Feature, or FeatureCollection containing polygon geometry.",
      };
    }
    return { geoJson: parsed };
  } catch {
    return { geoJson: null, error: "GeoJSON must be valid JSON." };
  }
};

export const formatPropertyBoundaryGeoJson = (value: unknown) => {
  if (!value) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
};

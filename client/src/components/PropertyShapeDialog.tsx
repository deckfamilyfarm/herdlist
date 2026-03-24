import { useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { GeoJSON, LayersControl, MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { isSupportedPropertyGeoJson } from "@/lib/geojson";

interface PropertyShapeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  boundaryGeoJson?: Record<string, unknown> | null;
  badgeLabel?: string;
  emptyMessage?: string;
}

const DEFAULT_CENTER: [number, number] = [39.8283, -98.5795];

function FitPropertyBounds({ geoJson }: { geoJson: Record<string, unknown> }) {
  const map = useMap();

  useEffect(() => {
    requestAnimationFrame(() => {
      map.invalidateSize();
    });

    const layer = L.geoJSON(geoJson as any);
    const bounds = layer.getBounds();

    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.12), { animate: false });
      return;
    }

    map.setView(DEFAULT_CENTER, 4, { animate: false });
  }, [geoJson, map]);

  return null;
}

export function PropertyShapeDialog({
  open,
  onOpenChange,
  title,
  boundaryGeoJson: rawBoundaryGeoJson,
  badgeLabel,
  emptyMessage,
}: PropertyShapeDialogProps) {
  const boundaryGeoJson = useMemo(() => {
    if (!rawBoundaryGeoJson) return null;
    return isSupportedPropertyGeoJson(rawBoundaryGeoJson)
      ? rawBoundaryGeoJson
      : null;
  }, [rawBoundaryGeoJson]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex w-[calc(100vw-1rem)] max-w-5xl h-[85vh] flex-col overflow-hidden p-0 gap-0 sm:h-[80vh]">
        <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 pr-8">
            <DialogTitle className="text-base sm:text-lg">
              {title || "Mapped Shape"}
            </DialogTitle>
            {badgeLabel && <Badge variant="secondary">{badgeLabel}</Badge>}
          </div>
        </DialogHeader>

        {boundaryGeoJson ? (
          <div className="min-h-0 flex-1">
            <MapContainer
              center={DEFAULT_CENTER}
              zoom={4}
              scrollWheelZoom
              className="h-full w-full"
            >
              <LayersControl position="topleft">
                <LayersControl.BaseLayer name="Streets">
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer checked name="Imagery">
                  <TileLayer
                    attribution='Tiles &copy; Esri'
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="Contours">
                  <TileLayer
                    attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
                    url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                  />
                </LayersControl.BaseLayer>
              </LayersControl>
              <GeoJSON
                data={boundaryGeoJson as any}
                style={() => ({
                  color: "#1d4ed8",
                  weight: 2.5,
                  fillColor: "#3b82f6",
                  fillOpacity: 0.22,
                })}
              />
              <FitPropertyBounds geoJson={boundaryGeoJson} />
            </MapContainer>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
            {emptyMessage || "This item does not have a boundary GeoJSON yet."}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

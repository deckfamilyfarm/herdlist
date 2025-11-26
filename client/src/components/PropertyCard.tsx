import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar } from "lucide-react";

interface Property {
  id: string;
  name: string;
  isLeased: string;
  leaseStartDate?: string;
  leaseEndDate?: string;
  leaseholder?: string;
  fieldCount: number;
  animalCount: number;
}

interface PropertyCardProps {
  property: Property;
  onClick?: (id: string) => void;
}

export function PropertyCard({ property, onClick }: PropertyCardProps) {
  return (
    <Card
      className="hover-elevate cursor-pointer"
      onClick={() => onClick?.(property.id)}
      data-testid={`card-property-${property.id}`}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-chart-1" />
          <CardTitle className="text-base">{property.name}</CardTitle>
        </div>
        {property.isLeased === "yes" && (
          <Badge variant="secondary" data-testid={`badge-leased-${property.id}`}>Leased</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {property.isLeased === "yes" && property.leaseholder && (
          <div className="text-sm">
            <p className="text-muted-foreground">Leaseholder</p>
            <p className="font-medium">{property.leaseholder}</p>
          </div>
        )}
        {property.isLeased === "yes" && (property.leaseStartDate || property.leaseEndDate) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              {property.leaseStartDate} - {property.leaseEndDate}
            </span>
          </div>
        )}
        <div className="flex gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Fields</p>
            <p className="font-semibold" data-testid={`text-field-count-${property.id}`}>{property.fieldCount}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Animals</p>
            <p className="font-semibold" data-testid={`text-animal-count-${property.id}`}>{property.animalCount}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, Plus, Edit } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Field {
  id: string;
  name: string;
  capacity?: number;
  currentCount: number;
}

interface Property {
  id: string;
  name: string;
  isLeased: string;
  leaseStartDate?: string;
  leaseEndDate?: string;
  leaseholder?: string;
  fields: Field[];
}

interface PropertyWithFieldsProps {
  property: Property;
  onAddField?: (propertyId: string) => void;
  onEditProperty?: (propertyId: string) => void;
  onEditField?: (fieldId: string) => void;
}

export function PropertyWithFields({ 
  property, 
  onAddField, 
  onEditProperty,
  onEditField 
}: PropertyWithFieldsProps) {
  const totalAnimals = property.fields.reduce((sum, field) => sum + field.currentCount, 0);
  const totalCapacity = property.fields.reduce((sum, field) => sum + (field.capacity || 0), 0);

  return (
    <Card data-testid={`card-property-${property.id}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <MapPin className="h-5 w-5 text-chart-1" />
            <CardTitle className="text-lg">{property.name}</CardTitle>
            {property.isLeased === "yes" && (
              <Badge variant="secondary" data-testid={`badge-leased-${property.id}`}>Leased</Badge>
            )}
          </div>
          {property.isLeased === "yes" && property.leaseholder && (
            <div className="mt-2 ml-8">
              <p className="text-sm text-muted-foreground">
                Leaseholder: <span className="font-medium text-foreground">{property.leaseholder}</span>
              </p>
              {(property.leaseStartDate || property.leaseEndDate) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    {property.leaseStartDate} - {property.leaseEndDate}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => onEditProperty?.(property.id)}
          data-testid={`button-edit-property-${property.id}`}
        >
          <Edit className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-6 text-sm">
            <div>
              <p className="text-muted-foreground">Total Fields</p>
              <p className="font-semibold text-lg" data-testid={`text-field-count-${property.id}`}>
                {property.fields.length}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Total Animals</p>
              <p className="font-semibold text-lg" data-testid={`text-animal-count-${property.id}`}>
                {totalAnimals}
              </p>
            </div>
            {totalCapacity > 0 && (
              <div>
                <p className="text-muted-foreground">Capacity</p>
                <p className="font-semibold text-lg">
                  {totalCapacity}
                </p>
              </div>
            )}
          </div>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => onAddField?.(property.id)}
            data-testid={`button-add-field-${property.id}`}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Field
          </Button>
        </div>

        {property.fields.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Field Name</TableHead>
                  <TableHead>Animals</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Utilization</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {property.fields.map((field) => {
                  const utilization = field.capacity 
                    ? Math.round((field.currentCount / field.capacity) * 100)
                    : null;
                  
                  return (
                    <TableRow key={field.id} data-testid={`row-field-${field.id}`}>
                      <TableCell className="font-medium">{field.name}</TableCell>
                      <TableCell className="font-mono" data-testid={`text-current-count-${field.id}`}>
                        {field.currentCount}
                      </TableCell>
                      <TableCell className="font-mono">
                        {field.capacity || '-'}
                      </TableCell>
                      <TableCell>
                        {utilization !== null ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-muted rounded-full h-2 max-w-[100px]">
                              <div 
                                className={`h-2 rounded-full ${
                                  utilization > 90 ? 'bg-destructive' : 
                                  utilization > 75 ? 'bg-chart-3' : 
                                  'bg-chart-4'
                                }`}
                                style={{ width: `${Math.min(utilization, 100)}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium">{utilization}%</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => onEditField?.(field.id)}
                          data-testid={`button-edit-field-${field.id}`}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-6 text-sm text-muted-foreground border rounded-md">
            No fields added yet
          </div>
        )}
      </CardContent>
    </Card>
  );
}

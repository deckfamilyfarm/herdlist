import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MoveRight } from "lucide-react";
import type { Movement } from "@shared/schema";

interface MovementHistoryTimelineProps {
  movements: Movement[];
}

type EnrichedMovement = Movement & {
  fromFieldName?: string | null;
  toFieldName?: string | null;
};

export function MovementHistoryTimeline({ movements }: MovementHistoryTimelineProps) {
  const enrichedMovements = movements as EnrichedMovement[];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Movements</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {enrichedMovements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent movements</p>
          ) : (
            enrichedMovements.map((movement) => (
              <div
                key={movement.id}
                className="flex items-start gap-3 border-l-2 border-chart-1 pl-4 pb-4 last:pb-0"
                data-testid={`movement-${movement.id}`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{movement.fromFieldName || "Unknown"}</span>
                    <MoveRight className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{movement.toFieldName || "Unknown"}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(movement.movementDate).toLocaleDateString()}
                  </p>
                  {movement.notes && (
                    <p className="text-sm mt-1">{movement.notes}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

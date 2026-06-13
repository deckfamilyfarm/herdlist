import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Shield } from "lucide-react";

const TIMESHEETS_URL = "https://timesheets.deckfamilyfarm.com";

export default function Admin() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Access Management</h1>
        <p className="text-muted-foreground mt-2">
          Herd List uses Timesheets as its login and user-role authority.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Managed in Timesheets
          </CardTitle>
          <CardDescription>
            User accounts, passwords, active status, and roles are managed in
            the Timesheets application.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Herd List no longer maintains a separate email whitelist or local
            registered-user list. Sign-in is validated against Timesheets, and
            launches from Timesheets exchange the current Timesheets access
            token for a Herd List session.
          </p>
          <p>
            To add or remove access, update the person in Timesheets. To limit
            Herd List access by Timesheets role, set
            <span className="mx-1 font-mono text-foreground">
              HERDLIST_TIMESHEETS_ALLOWED_ROLES
            </span>
            in the Herd List server environment.
          </p>
          <Button asChild>
            <a href={TIMESHEETS_URL} target="_blank" rel="noreferrer">
              Open Timesheets
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

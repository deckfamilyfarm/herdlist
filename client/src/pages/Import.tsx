import { ImportWizard } from "@/components/ImportWizard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, AlertCircle, Info } from "lucide-react";

export default function Import() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Import Data</h1>
        <p className="text-muted-foreground">Import existing herd data from CSV files</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ImportWizard />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="h-4 w-4" />
                Import Process
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div>
                <p className="font-medium text-foreground mb-1">Step 1: Select Data Type</p>
                <p>Choose what type of data you want to import</p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">Step 2: Download Template</p>
                <p>Get the CSV template with correct column headers</p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">Step 3: Upload File</p>
                <p>Drag and drop or browse for your CSV file</p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">Step 4: Review & Import</p>
                <p>Preview data and click import to complete</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertCircle className="h-4 w-4" />
                Important Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• All dates must be in YYYY-MM-DD format</li>
                <li>• Animal tag numbers must be unique</li>
                <li>• Reference fields (sireTag, damTag, etc.) must match existing records</li>
                <li>• Type must be "dairy" or "beef"</li>
                <li>• Sex must be "male" or "female"</li>
                <li>• Breeding method: "live-cover" or "ai"</li>
                <li>• Property isLeased: "yes" or "no"</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                Supported Data Types
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Animals</li>
                <li>• Properties</li>
                <li>• Fields</li>
                <li>• Vaccinations</li>
                <li>• Events</li>
                <li>• Calving Records</li>
                <li>• Slaughter Records</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

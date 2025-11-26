import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, CheckCircle2, AlertCircle, Download } from "lucide-react";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";
import type { ImportResult } from "@shared/schema";

const DATA_TYPES = [
  { value: "animals", label: "Animals" },
  { value: "properties", label: "Properties" },
  { value: "fields", label: "Fields" },
  { value: "vaccinations", label: "Vaccinations" },
  { value: "events", label: "Events" },
  { value: "calving-records", label: "Calving Records" },
  { value: "slaughter-records", label: "Slaughter Records" },
] as const;

const CSV_TEMPLATES: Record<string, string[]> = {
  animals: ["tagNumber", "name", "type", "sex", "dateOfBirth", "breedingMethod", "sireTag", "damTag", "herdName", "organic"],
  properties: ["name", "isLeased", "leaseStartDate", "leaseEndDate", "leaseholder"],
  fields: ["name", "propertyName", "capacity"],
  vaccinations: ["animalTag", "vaccineName", "administeredDate", "administeredBy", "nextDueDate"],
  events: ["animalTag", "eventType", "eventDate", "description"],
  "calving-records": ["damTag", "calvingDate", "calfTag", "calfSex", "notes"],
  "slaughter-records": ["animalTag", "slaughterDate", "ageMonths", "liveWeight", "hangingWeight", "processor"],
};

const FORMAT_NOTES: Record<string, string[]> = {
  animals: [
    "type: dairy or beef",
    "sex: male or female",
    "dateOfBirth: YYYY-MM-DD",
    "breedingMethod: live-cover or ai",
    "herdName: wet, nurse, finish, main, grafting, or yearlings",
    "organic: true or false",
    "Use the Movements feature to assign animals to fields",
  ],
  properties: [
    "isLeased: yes or no",
    "Dates: YYYY-MM-DD format",
  ],
  fields: [
    "propertyName must match existing property",
    "capacity: number",
  ],
  vaccinations: [
    "animalTag must match existing animal",
    "Dates: YYYY-MM-DD format",
  ],
  events: [
    "animalTag must match existing animal",
    "eventDate: YYYY-MM-DD",
  ],
  "calving-records": [
    "damTag must match existing animal",
    "calvingDate: YYYY-MM-DD",
    "calfSex: male or female",
  ],
  "slaughter-records": [
    "animalTag must match existing animal",
    "slaughterDate: YYYY-MM-DD",
    "Weights: decimal numbers",
  ],
};

export function ImportWizard() {
  const [dataType, setDataType] = useState<string>("");
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async ({ type, csvData }: { type: string; csvData: string }): Promise<ImportResult> => {
      const res = await apiRequest("POST", `/api/import/${type}`, { csvData });
      return await res.json();
    },
    onSuccess: (data: ImportResult) => {
      setImportResult(data);
      if (data.success > 0) {
        toast({
          title: "Import Successful",
          description: `Successfully imported ${data.success} records.${data.failed > 0 ? ` ${data.failed} failed.` : ""}`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/animals"] });
        queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
        queryClient.invalidateQueries({ queryKey: ["/api/fields"] });
      } else {
        toast({
          title: "Import Failed",
          description: `All ${data.failed} records failed to import.`,
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Import Error",
        description: error.message || "Failed to import data",
        variant: "destructive",
      });
    },
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleFile = (selectedFile: File) => {
    setFile(selectedFile);
    setImportResult(null);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      setPreviewData(parsed.data.slice(0, 5));
    };
    reader.readAsText(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleImport = () => {
    if (!file || !dataType) {
      toast({
        title: "Missing Information",
        description: "Please select a data type and file to import.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      importMutation.mutate({ type: dataType, csvData: text });
    };
    reader.readAsText(file);
  };

  const handleClear = () => {
    setFile(null);
    setPreviewData([]);
    setImportResult(null);
    setDataType("");
  };

  const downloadTemplate = () => {
    if (!dataType) {
      toast({
        title: "Select Data Type",
        description: "Please select a data type first.",
        variant: "destructive",
      });
      return;
    }

    const headers = CSV_TEMPLATES[dataType];
    const csv = headers.join(",");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${dataType}-template.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import Herd Data</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block" data-testid="label-data-type">
              Select Data Type
            </label>
            <Select value={dataType} onValueChange={setDataType}>
              <SelectTrigger data-testid="select-data-type">
                <SelectValue placeholder="Choose data type to import" />
              </SelectTrigger>
              <SelectContent>
                {DATA_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {dataType && (
            <div className="bg-muted p-4 rounded-md space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">CSV Format for {DATA_TYPES.find(t => t.value === dataType)?.label}</h4>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={downloadTemplate}
                  data-testid="button-download-template"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Template
                </Button>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-medium">Columns: {CSV_TEMPLATES[dataType].join(", ")}</p>
                {FORMAT_NOTES[dataType] && (
                  <ul className="list-disc list-inside space-y-0.5 mt-2">
                    {FORMAT_NOTES[dataType].map((note, i) => (
                      <li key={i}>{note}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        <div
          className={`border-2 border-dashed rounded-md p-12 text-center transition-colors ${
            dragActive ? "border-primary bg-accent/50" : "border-border"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          data-testid="dropzone-upload"
        >
          {file ? (
            <div className="space-y-2">
              <FileText className="h-12 w-12 mx-auto text-chart-4" />
              <p className="font-medium" data-testid="text-filename">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {(file.size / 1024).toFixed(2)} KB
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="font-medium">Drag and drop your CSV file here</p>
              <p className="text-sm text-muted-foreground">
                Supports CSV files only
              </p>
            </div>
          )}
          <input
            type="file"
            id="file-upload"
            className="hidden"
            accept=".csv"
            onChange={handleFileChange}
          />
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => document.getElementById("file-upload")?.click()}
            data-testid="button-browse-files"
          >
            Browse Files
          </Button>
        </div>

        {previewData.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Preview (first 5 rows)</h4>
            <div className="border rounded-md overflow-auto max-h-64">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    {Object.keys(previewData[0] || {}).map((key) => (
                      <th key={key} className="p-2 text-left font-medium">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, i) => (
                    <tr key={i} className="border-t">
                      {Object.values(row).map((val: any, j) => (
                        <td key={j} className="p-2">{val || "-"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {importMutation.isPending && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Importing data...</p>
            <Progress value={50} />
          </div>
        )}

        {importResult && (
          <div className="space-y-4">
            <div className={`p-4 rounded-md ${importResult.failed > 0 ? "bg-destructive/10" : "bg-chart-4/10"}`}>
              <div className="flex items-start gap-3">
                {importResult.failed > 0 ? (
                  <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-chart-4 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 space-y-1">
                  <p className="font-medium" data-testid="text-import-result">
                    Import Complete: {importResult.success} successful, {importResult.failed} failed
                  </p>
                  {importResult.errors.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-sm font-medium">Errors:</p>
                      <div className="max-h-48 overflow-auto space-y-1">
                        {importResult.errors.map((err, i) => (
                          <div key={i} className="text-xs bg-background/50 p-2 rounded">
                            <p className="font-medium">Row {err.row}: {err.error}</p>
                            <p className="text-muted-foreground mt-1">{JSON.stringify(err.data)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {file && !importMutation.isPending && (
          <div className="flex gap-2">
            <Button 
              onClick={handleImport} 
              disabled={!dataType || importMutation.isPending}
              data-testid="button-import"
            >
              Import Data
            </Button>
            <Button variant="outline" onClick={handleClear} data-testid="button-clear">
              Clear
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

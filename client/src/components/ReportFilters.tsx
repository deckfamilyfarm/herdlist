import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { FileDown } from "lucide-react";

export function ReportFilters() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Report Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="report-date">As of Date</Label>
            <Input id="report-date" type="date" data-testid="input-report-date" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="animal-type">Animal Type</Label>
            <Select>
              <SelectTrigger id="animal-type" data-testid="select-animal-type">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="dairy">Dairy</SelectItem>
                <SelectItem value="beef">Beef</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="property">Property</Label>
            <Select>
              <SelectTrigger id="property" data-testid="select-property">
                <SelectValue placeholder="All properties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Properties</SelectItem>
                <SelectItem value="home-farm">Home Farm</SelectItem>
                <SelectItem value="south-pasture">South Pasture Lease</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select>
              <SelectTrigger id="status" data-testid="select-status">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="slaughtered">Slaughtered</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-2 pt-4">
          <Button data-testid="button-generate-report">Generate Report</Button>
          <Button variant="outline" data-testid="button-export">
            <FileDown className="h-4 w-4 mr-2" />
            Export to CSV
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

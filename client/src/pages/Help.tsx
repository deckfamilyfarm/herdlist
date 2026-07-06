import type { ComponentType, ReactNode } from "react";
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  LayoutDashboard,
  Layers,
  List,
  MapPin,
  MoveRight,
  Scale,
  Search,
  Settings,
  Upload,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type IconComponent = ComponentType<{ className?: string }>;

const tocItems = [
  { id: "quick-start", title: "Quick Start", icon: BookOpen },
  { id: "dashboard", title: "Dashboard", icon: LayoutDashboard },
  { id: "animals", title: "Add and Manage Animals", icon: List },
  { id: "moves", title: "Move Animals", icon: MoveRight },
  { id: "lots", title: "Sheep Lots", icon: Layers },
  { id: "reports", title: "Reports", icon: BarChart3 },
  { id: "slaughter-sold", title: "Slaughtered and Sold Animals", icon: Scale },
  { id: "fields", title: "Properties and Fields", icon: MapPin },
  { id: "import", title: "Import Data", icon: Upload },
  { id: "settings", title: "Sheep Tracking Settings", icon: Settings },
  { id: "troubleshooting", title: "Troubleshooting", icon: AlertCircle },
];

function HelpSection({
  id,
  title,
  icon: Icon,
  children,
}: {
  id: string;
  title: string;
  icon: IconComponent;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6 space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function StepList({ items }: { items: string[] }) {
  return (
    <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ol>
  );
}

function Tip({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
      <div className="flex gap-2">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>{children}</p>
      </div>
    </div>
  );
}

function ScreenPreview({
  title,
  eyebrow = "Preview",
  children,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-md border bg-background">
      <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
        <div>
          <p className="text-[11px] font-medium uppercase text-muted-foreground">{eyebrow}</p>
          <p className="text-sm font-semibold">{title}</p>
        </div>
        <div className="flex gap-1">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
        </div>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function MiniTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: Array<Array<ReactNode>>;
}) {
  return (
    <div className="overflow-hidden rounded-md border">
      <div className="grid bg-muted/50 text-xs font-medium text-muted-foreground" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
        {columns.map((column) => (
          <div key={column} className="px-2 py-1.5">
            {column}
          </div>
        ))}
      </div>
      {rows.map((row, index) => (
        <div
          key={index}
          className="grid border-t text-xs"
          style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
        >
          {row.map((cell, cellIndex) => (
            <div key={cellIndex} className="min-w-0 truncate px-2 py-1.5">
              {cell}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function ButtonPreview({ children, variant = "default" }: { children: ReactNode; variant?: "default" | "outline" }) {
  return (
    <span
      className={
        variant === "outline"
          ? "inline-flex h-8 items-center rounded-md border bg-background px-3 text-xs font-medium"
          : "inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground"
      }
    >
      {children}
    </span>
  );
}

export default function Help() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            Help
          </h1>
          <p className="max-w-3xl text-muted-foreground">
            A practical guide to the main Herd Manager workflows. Use this when training a new user or checking the
            right place to record an animal, lot, movement, report, or sale.
          </p>
        </div>
        <Badge variant="outline" className="w-fit">
          Herd Manager Manual
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-0 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Table of Contents</CardTitle>
              <CardDescription>Jump to the task you need.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {tocItems.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </a>
              ))}
            </CardContent>
          </Card>
        </aside>

        <div className="space-y-8">
          <HelpSection id="quick-start" title="Quick Start" icon={BookOpen}>
            <Card>
              <CardContent className="grid gap-4 p-6 md:grid-cols-3">
                <div className="space-y-2">
                  <Badge variant="secondary">1</Badge>
                  <h3 className="font-semibold">Set up locations</h3>
                  <p className="text-sm text-muted-foreground">
                    Add properties and fields first. Animal and lot movements depend on field names.
                  </p>
                </div>
                <div className="space-y-2">
                  <Badge variant="secondary">2</Badge>
                  <h3 className="font-semibold">Add inventory</h3>
                  <p className="text-sm text-muted-foreground">
                    Use Animals for individually tracked cattle and AI records. Use Lots for sheep or other grouped
                    livestock.
                  </p>
                </div>
                <div className="space-y-2">
                  <Badge variant="secondary">3</Badge>
                  <h3 className="font-semibold">Record changes as they happen</h3>
                  <p className="text-sm text-muted-foreground">
                    Move animals or lots when they change fields, and record sold, slaughtered, birth, death, and count
                    changes promptly.
                  </p>
                </div>
              </CardContent>
            </Card>
          </HelpSection>

          <HelpSection id="dashboard" title="Dashboard" icon={LayoutDashboard}>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">What the dashboard tells you</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    The dashboard is a quick operating view. It shows living animal totals, dairy and beef counts, AI
                    records, sheep lot totals, cows ready to breed, animal counts by field, recent movements, and recent
                    animals.
                  </p>
                  <p>
                    Total Living Animals excludes AI records and includes sheep lot head counts. The field chart also
                    excludes AI and shows sheep as a single green Sheep category.
                  </p>
                </CardContent>
              </Card>
              <ScreenPreview title="Dashboard cards and field counts">
                <div className="grid grid-cols-2 gap-2">
                  {["Total Living Animals", "Dairy Cows", "Beef Cattle", "Sheep"].map((label, index) => (
                    <div key={label} className="rounded-md border bg-muted/30 p-2">
                      <p className="text-[11px] text-muted-foreground">{label}</p>
                      <p className="text-lg font-semibold">{[148, 62, 41, 45][index]}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 space-y-2">
                  <div className="h-3 rounded bg-primary/70" />
                  <div className="h-3 w-4/5 rounded bg-green-600/70" />
                  <div className="h-3 w-3/5 rounded bg-amber-600/70" />
                </div>
              </ScreenPreview>
            </div>
          </HelpSection>

          <HelpSection id="animals" title="Add and Manage Animals" icon={List}>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Add a single animal</CardTitle>
                  <CardDescription>Use this for cattle and other individually tracked animals.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <StepList
                    items={[
                      "Open Animals from the navigation.",
                      "Select Add Animal.",
                      "Enter the tag number and the required identity fields.",
                      "Choose the animal type, sex, status, and current field.",
                      "Add optional details such as date of birth, genetics, tags, notes, or breeding details.",
                      "Save the animal. It will appear in the Animals list and dashboard counts.",
                    ]}
                  />
                  <Tip>
                    Use the search box, field filter, type filter, status filter, and tag filters to find a smaller
                    working group before editing or moving animals.
                  </Tip>
                </CardContent>
              </Card>
              <ScreenPreview title="Animals list">
                <div className="mb-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
                    <Search className="h-3 w-3" />
                    Search
                  </span>
                  <ButtonPreview>Add Animal</ButtonPreview>
                </div>
                <MiniTable
                  columns={["Tag", "Type", "Field", "Status"]}
                  rows={[
                    ["A142", "Dairy", "North 4", <Badge key="active">Active</Badge>],
                    ["B018", "Beef", "South 2", <Badge key="active">Active</Badge>],
                    ["AI-23", "AI", "-", <Badge key="active">Active</Badge>],
                  ]}
                />
              </ScreenPreview>
            </div>
          </HelpSection>

          <HelpSection id="moves" title="Move Animals" icon={MoveRight}>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Move selected animals from the Animals list</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <StepList
                    items={[
                      "Open Animals and filter the list if needed.",
                      "Select individual rows, or use Select all to select every visible animal.",
                      "Choose Move to field from the update option menu.",
                      "Pick the destination field and movement date.",
                      "Add an optional note, then select Move selected.",
                    ]}
                  />
                  <Tip>
                    A movement updates each selected animal's current field and records movement history for reporting.
                    Sheep lot moves are handled separately in Lots.
                  </Tip>
                </CardContent>
              </Card>
              <ScreenPreview title="Bulk move controls">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 rounded-md border p-2">
                    <ButtonPreview variant="outline">Select all (24)</ButtonPreview>
                    <ButtonPreview variant="outline">Deselect all</ButtonPreview>
                    <span className="text-xs text-muted-foreground">Selected: 12</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-md border px-2 py-2 text-xs text-muted-foreground">Move to field</div>
                    <div className="rounded-md border px-2 py-2 text-xs text-muted-foreground">Movement date</div>
                  </div>
                  <ButtonPreview>Move selected</ButtonPreview>
                </div>
              </ScreenPreview>
            </div>
          </HelpSection>

          <HelpSection id="lots" title="Sheep Lots" icon={Layers}>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Track sheep as lots</CardTitle>
                  <CardDescription>
                    A lot is a group of animals tracked together, with counts by class instead of individual tag
                    numbers.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <StepList
                    items={[
                      "Open Lots from the navigation.",
                      "Select Add Lot.",
                      "Name the lot, choose its field, and enter counts for ewes, rams, lambs, wethers, and unknown.",
                      "Save the lot. The total is included in sheep and living-animal counts.",
                      "Use the arrow action to move a lot. Move the entire lot or, when allowed, enter partial counts to split or merge.",
                      "Use the plus action to record births, deaths, purchases, sales, corrections, and other count changes.",
                    ]}
                  />
                  <Tip>
                    Lots are best for sheep flocks where exact individual identity is not needed. Use Animals only when
                    a sheep needs individual tracking.
                  </Tip>
                </CardContent>
              </Card>
              <ScreenPreview title="Lots inventory">
                <MiniTable
                  columns={["Lot", "Field", "Ewes", "Lambs", "Total"]}
                  rows={[
                    ["Spring flock", "Hill 1", 24, 31, 57],
                    ["Rams", "Barn", 0, 0, 3],
                    ["Market lambs", "South 5", 0, 18, 18],
                  ]}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <ButtonPreview variant="outline">Move</ButtonPreview>
                  <ButtonPreview variant="outline">Count change</ButtonPreview>
                  <ButtonPreview variant="outline">History</ButtonPreview>
                </div>
              </ScreenPreview>
            </div>
          </HelpSection>

          <HelpSection id="reports" title="Reports" icon={BarChart3}>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Run a report</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <StepList
                    items={[
                      "Open Reports from the navigation.",
                      "Choose an as-of date when you need a point-in-time list.",
                      "Filter by animal type, status, fields, tags, or due-date options.",
                      "Choose the grouping that matches how you want to read the report.",
                      "Review the herd summary, property breakdown, sheep lot inventory, or grazing report sections.",
                      "Export CSV for spreadsheets or PDF for printing and sharing.",
                    ]}
                  />
                  <Tip>
                    Reports use the current animal records, movement history, slaughter/sold records, field assignments,
                    and lot counts. If something looks wrong, first check the animal or lot location and status.
                  </Tip>
                </CardContent>
              </Card>
              <ScreenPreview title="Report filters and output">
                <div className="grid gap-2 sm:grid-cols-2">
                  {["As-of date", "Animal type", "Status", "Fields"].map((label) => (
                    <div key={label} className="rounded-md border px-2 py-2 text-xs text-muted-foreground">
                      {label}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <ButtonPreview variant="outline">CSV</ButtonPreview>
                  <ButtonPreview variant="outline">PDF</ButtonPreview>
                </div>
              </ScreenPreview>
            </div>
          </HelpSection>

          <HelpSection id="slaughter-sold" title="Slaughtered and Sold Animals" icon={Scale}>
            <Card>
              <CardContent className="space-y-4 p-6">
                <StepList
                  items={[
                    "Open Slaughter/Sold from the navigation.",
                    "Select Add Record.",
                    "Choose the active animal and select whether it was slaughtered or sold.",
                    "Enter the date and any useful details such as live weight, hanging weight, processor, buyer, or price.",
                    "Save the record. The animal is removed from active inventory and no longer appears in living-animal totals.",
                  ]}
                />
                <Tip>
                  Use Slaughter/Sold instead of deleting an animal. Deleting removes the record; slaughter/sold keeps the
                  historical record for reports.
                </Tip>
              </CardContent>
            </Card>
          </HelpSection>

          <HelpSection id="fields" title="Properties and Fields" icon={MapPin}>
            <Card>
              <CardContent className="grid gap-4 p-6 md:grid-cols-2">
                <div className="space-y-3">
                  <h3 className="font-semibold">Set up the map of the farm</h3>
                  <StepList
                    items={[
                      "Open Properties & Fields.",
                      "Add each property or farm location.",
                      "Add fields under the correct property.",
                      "Use clear field names because they appear in animal lists, lot lists, dashboard charts, and reports.",
                    ]}
                  />
                </div>
                <ScreenPreview title="Property and field hierarchy">
                  <div className="space-y-2 text-sm">
                    <div className="rounded-md border p-2">
                      <p className="font-medium">Home Farm</p>
                      <p className="text-xs text-muted-foreground">North 1, North 2, Barn</p>
                    </div>
                    <div className="rounded-md border p-2">
                      <p className="font-medium">Lease Ground</p>
                      <p className="text-xs text-muted-foreground">Hill 1, South 5</p>
                    </div>
                  </div>
                </ScreenPreview>
              </CardContent>
            </Card>
          </HelpSection>

          <HelpSection id="import" title="Import Data" icon={Upload}>
            <Card>
              <CardContent className="space-y-4 p-6">
                <StepList
                  items={[
                    "Open Import Data.",
                    "Select the data type you want to import.",
                    "Download the template so your CSV has the expected column headers.",
                    "Fill in the CSV. Use YYYY-MM-DD for dates and make sure tag numbers are unique.",
                    "Upload the file, review the preview, then import.",
                  ]}
                />
                <Tip>
                  Imports are fastest when locations and referenced animals already exist. For example, sire and dam tag
                  numbers must match existing animal records.
                </Tip>
              </CardContent>
            </Card>
          </HelpSection>

          <HelpSection id="settings" title="Sheep Tracking Settings" icon={Settings}>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Configure how sheep are tracked</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground">
                  <p>
                    Open Lots and select Settings. These options control whether sheep are treated primarily as lots,
                    whether partial lot moves are allowed, whether split and merge workflows are allowed, and whether
                    individually tracked sheep can also be used.
                  </p>
                  <p>
                    In the current workflow, sheep are usually tracked as lots. If a sheep needs individual records, such
                    as a breeding ram or registered ewe, enable individual sheep and add that animal from Animals.
                  </p>
                </CardContent>
              </Card>
              <ScreenPreview title="Sheep tracking settings">
                <div className="space-y-2">
                  {["Tracking mode: Lot", "Allow partial lot moves", "Allow split and merge", "Allow individual sheep"].map(
                    (label) => (
                      <div key={label} className="flex items-center gap-2 rounded-md border px-2 py-2 text-xs">
                        <span className="h-3 w-3 rounded-sm border bg-primary" />
                        {label}
                      </div>
                    ),
                  )}
                </div>
              </ScreenPreview>
            </div>
          </HelpSection>

          <HelpSection id="troubleshooting" title="Troubleshooting" icon={AlertCircle}>
            <Card>
              <CardContent className="grid gap-4 p-6 md:grid-cols-2">
                <div className="space-y-2">
                  <h3 className="font-semibold">Dashboard counts look wrong</h3>
                  <p className="text-sm text-muted-foreground">
                    Confirm animals are active, assigned to a field when expected, and not marked slaughtered or sold. AI
                    records are intentionally excluded from Total Living Animals and the field chart.
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold">A field chart is missing animals</h3>
                  <p className="text-sm text-muted-foreground">
                    The chart only shows living animals and active lot head counts with a field assignment. Animals or
                    lots with no location will not appear under a field.
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold">A lot count is off</h3>
                  <p className="text-sm text-muted-foreground">
                    Open Lots, select the history action, and review count changes. Use Record Count Change for
                    corrections, births, deaths, purchases, or sales.
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold">A report is missing historical activity</h3>
                  <p className="text-sm text-muted-foreground">
                    Check that movements were recorded with the correct dates and that slaughter or sale records were
                    entered instead of deleting animals.
                  </p>
                </div>
              </CardContent>
            </Card>
          </HelpSection>
        </div>
      </div>
    </div>
  );
}

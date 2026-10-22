import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AnimalListItem, Field, Owner } from "@shared/schema";
import {
  addServiceDays, addServiceMonths, isServiceDate, isServiceMonth, serviceToday,
  type ServiceContractReport, type ServiceRate, type ServiceReport,
} from "@shared/grazingServices";

type Contract = Omit<ServiceContractReport, "headDays" | "amountCents" | "unpricedHeadDays" | "rows">;
type Assignment = { id: string; animalId: string; tagNumber: string; startDate: string; endDate: string | null };
type RateForm = {
  originalDate: string; effectiveDate: string; rate: string; seasonEnabled: boolean;
  seasonStartMonth: string; seasonEndMonth: string; ageThresholdMonths: string;
  olderRate: string; youngerRate: string; freeUnderMonths: string;
};
const emptyRate = (hasRates = false): RateForm => ({
  originalDate: "", effectiveDate: hasRates ? serviceToday() : "2015-01-01", rate: "",
  seasonEnabled: false, seasonStartMonth: "12", seasonEndMonth: "3", ageThresholdMonths: "12",
  olderRate: "", youngerRate: "", freeUnderMonths: "",
});
const formFromRate = (rate: ServiceRate, originalDate = rate.effectiveDate): RateForm => ({
  originalDate, effectiveDate: originalDate || serviceToday(), rate: (rate.rateCents / 100).toFixed(2),
  seasonEnabled: rate.seasonStartMonth != null,
  seasonStartMonth: String(rate.seasonStartMonth ?? 12), seasonEndMonth: String(rate.seasonEndMonth ?? 3),
  ageThresholdMonths: String(rate.ageThresholdMonths ?? 12),
  olderRate: rate.olderRateCents == null ? "" : (rate.olderRateCents / 100).toFixed(2),
  youngerRate: rate.youngerRateCents == null ? "" : (rate.youngerRateCents / 100).toFixed(2),
  freeUnderMonths: rate.freeUnderMonths == null ? "" : String(rate.freeUnderMonths),
});
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const validAmount = (value: string) => /^\d+(\.\d{1,2})?$/.test(value) && Number(value) <= 1000000;
const emptyContract = (): Contract => ({
  id: "", name: "", ownerId: "creamy-cow-llc", ownerName: "", kind: "general",
  activeFrom: serviceToday(), activeTo: null, dairyBarnFieldId: null,
});
const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const priorMonth = () => addServiceMonths(`${serviceToday().slice(0, 7)}-01`, -1).slice(0, 7);
const issueDetails: Partial<Record<ServiceReport["issues"][number]["code"], { label: string; description: string }>> = {
  unknownLocation: {
    label: "No dated location",
    description: "No movement establishes a field for these report dates. The current field may still be known and is used for eligible charges.",
  },
  currentLocationMismatch: {
    label: "Current location mismatch",
    description: "The animal’s current field differs from its latest movement destination. Please review the records; a known outside-Dairy-Barn location can still count.",
  },
};
const issueLabel = (code: ServiceReport["issues"][number]["code"]) =>
  issueDetails[code]?.label || `${code[0].toUpperCase()}${code.slice(1).replace(/([A-Z])/g, " $1").toLowerCase()}`;

export default function GrazingServices() {
  const { toast } = useToast();
  const [month, setMonth] = useState(priorMonth);
  const [ownerName, setOwnerName] = useState("");
  const [selectedContractId, setSelectedContractId] = useState("");
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [ownerDialogOpen, setOwnerDialogOpen] = useState(false);
  const [contractForm, setContractForm] = useState<Contract>(emptyContract);
  const [rateForm, setRateForm] = useState<RateForm>(emptyRate);
  const [rateBusy, setRateBusy] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState({ id: "", contractId: "", animalId: "", startDate: serviceToday(), endDate: "" });
  const { data: owners = [] } = useQuery<Owner[]>({ queryKey: ["/api/grazing-services/owners"] });
  const { data: fields = [] } = useQuery<Field[]>({ queryKey: ["/api/fields"] });
  const { data: animals = [] } = useQuery<AnimalListItem[]>({ queryKey: ["/api/animals"] });
  const { data: contracts = [] } = useQuery<Contract[]>({ queryKey: ["/api/grazing-services/contracts"] });
  const rateUrl = `/api/grazing-services/contracts/${contractForm.id}/rates`;
  const { data: rates = [] } = useQuery<ServiceRate[]>({ queryKey: [rateUrl], enabled: !!contractForm.id });
  useEffect(() => {
    if (rates.length && !rateForm.originalDate && rateForm.effectiveDate === "2015-01-01")
      setRateForm({ ...formFromRate(rates.at(-1)!, ""), effectiveDate: serviceToday() });
  }, [rates, rateForm.originalDate, rateForm.effectiveDate]);
  useEffect(() => {
    if (contracts.length && !selectedContractId) {
      setSelectedContractId(contracts.find((contract) => contract.id === "creamy-cow-dairy")?.id || contracts[0].id);
    }
  }, [contracts, selectedContractId]);
  const { data: assignments = [] } = useQuery<Assignment[]>({
    queryKey: [`/api/grazing-services/contracts/${assignmentForm.contractId}/assignments`],
    enabled: !!assignmentForm.contractId,
  });
  const reportUrl = `/api/grazing-services/report?month=${month}`;
  const { data: report, isLoading, error } = useQuery<ServiceReport>({ queryKey: [reportUrl], enabled: isServiceMonth(month) && month <= serviceToday().slice(0, 7) });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/grazing-services/owners"] });
    queryClient.invalidateQueries({ queryKey: ["/api/grazing-services/contracts"] });
    queryClient.invalidateQueries({ predicate: (query) =>
      String(query.queryKey[0]).startsWith("/api/grazing-services/report?") });
    if (contractForm.id) queryClient.invalidateQueries({ queryKey: [rateUrl] });
    if (assignmentForm.contractId) queryClient.invalidateQueries({
      queryKey: [`/api/grazing-services/contracts/${assignmentForm.contractId}/assignments`],
    });
  };
  async function run(action: () => Promise<void>, success: string) {
    try { await action(); refresh(); toast({ title: success }); }
    catch (failure) { toast({ title: "Could not save", description: String(failure), variant: "destructive" }); }
  }
  function stepMonth(delta: number) {
    const next = addServiceMonths(`${month}-01`, delta).slice(0, 7);
    if (next <= serviceToday().slice(0, 7)) setMonth(next);
  }
  async function saveContract() {
    const body = {
      name: contractForm.name, ownerId: contractForm.ownerId, kind: contractForm.kind,
      activeFrom: contractForm.activeFrom, activeTo: contractForm.activeTo || null,
      dairyBarnFieldId: contractForm.kind === "dairy" ? contractForm.dairyBarnFieldId : null,
    };
    await run(async () => {
      const response = await apiRequest(contractForm.id ? "PUT" : "POST",
        contractForm.id ? `/api/grazing-services/contracts/${contractForm.id}` : "/api/grazing-services/contracts", body);
      const saved = await response.json() as { id: string };
      setSelectedContractId(saved.id);
      setContractForm({ ...contractForm, id: saved.id,
        ownerName: owners.find((owner) => owner.id === contractForm.ownerId)?.name || "" });
      setRateForm(emptyRate());
    }, "Contract saved");
  }
  async function saveRate() {
    if (!contractForm.id || rateBusy) return;
    const body = {
      effectiveDate: rateForm.effectiveDate, rateCents: Math.round(Number(rateForm.rate) * 100),
      seasonStartMonth: rateForm.seasonEnabled ? Number(rateForm.seasonStartMonth) : null,
      seasonEndMonth: rateForm.seasonEnabled ? Number(rateForm.seasonEndMonth) : null,
      ageThresholdMonths: rateForm.seasonEnabled ? Number(rateForm.ageThresholdMonths) : null,
      olderRateCents: rateForm.seasonEnabled ? Math.round(Number(rateForm.olderRate) * 100) : null,
      youngerRateCents: rateForm.seasonEnabled ? Math.round(Number(rateForm.youngerRate) * 100) : null,
      freeUnderMonths: rateForm.freeUnderMonths === "" ? null : Number(rateForm.freeUnderMonths),
    };
    setRateBusy(true);
    try {
      await apiRequest(rateForm.originalDate ? "PUT" : "POST",
        rateForm.originalDate ? `${rateUrl}/${rateForm.originalDate}` : rateUrl, body);
      queryClient.invalidateQueries({ queryKey: [rateUrl] });
      queryClient.invalidateQueries({ predicate: (query) =>
        String(query.queryKey[0]).startsWith("/api/grazing-services/report?") });
      setRateForm({ ...rateForm, originalDate: "", effectiveDate: serviceToday() });
      toast({ title: "Contract rate saved" });
    } catch (failure) {
      toast({ title: "Could not save rate", description: String(failure), variant: "destructive" });
    } finally { setRateBusy(false); }
  }
  async function saveAssignment() {
    await run(async () => {
      await apiRequest(assignmentForm.id ? "PUT" : "POST",
        assignmentForm.id ? `/api/grazing-services/assignments/${assignmentForm.id}` :
          `/api/grazing-services/contracts/${assignmentForm.contractId}/assignments`,
        { animalId: assignmentForm.animalId, startDate: assignmentForm.startDate,
          endDate: assignmentForm.endDate || null });
      setAssignmentForm({ ...assignmentForm, id: "", animalId: "", endDate: "" });
    }, "Assignment saved");
  }
  const generalContracts = contracts.filter((contract) => contract.kind === "general");
  const selectedReportContract = report?.contracts.find((contract) => contract.id === selectedContractId);
  const selectedWarnings = report?.issues.filter((issue) => issue.contractIds.includes(selectedContractId)) || [];
  return <div className="space-y-6" data-testid="grazing-services">
    <div><h1 className="text-3xl font-bold">Grazing Services</h1>
      <p className="text-muted-foreground">Deck Family Farm Grazing · Monthly head-day charges</p></div>
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1"><Label htmlFor="grazing-contract">Contract</Label><select id="grazing-contract"
        className="min-w-64 rounded-md border bg-background p-2" value={selectedContractId}
        onChange={(event) => setSelectedContractId(event.target.value)}>
        <option value="" disabled>{contracts.length ? "Select contract" : "Loading contracts…"}</option>
        {contracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.name}</option>)}
      </select></div>
      <Button variant="outline" onClick={() => {
        setContractForm(contracts.find((contract) => contract.id === selectedContractId) || emptyContract());
        setRateForm(emptyRate());
        setContractDialogOpen(true);
      }}>Contracts and rules</Button>
      <Button variant="outline" onClick={() => {
        if (generalContracts.some((contract) => contract.id === selectedContractId)) {
          setAssignmentForm({ id: "", contractId: selectedContractId, animalId: "", startDate: serviceToday(), endDate: "" });
        }
        setOwnerDialogOpen(true);
      }}>Owners and animal assignments</Button>
    </div>
    <Card><CardHeader><CardTitle>Monthly charges</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <Button variant="outline" aria-label="Previous month" onClick={() => stepMonth(-1)}>←</Button>
        <div className="space-y-1"><Label htmlFor="service-month">Month</Label>
          <Input id="service-month" type="month" max={serviceToday().slice(0, 7)} value={month}
            onChange={(event) => setMonth(event.target.value)} /></div>
        <Button variant="outline" aria-label="Next month" disabled={month >= serviceToday().slice(0, 7)} onClick={() => stepMonth(1)}>→</Button>
      </div>
      {!isServiceMonth(month) || month > serviceToday().slice(0, 7) ? <p role="alert">Choose a valid month through today.</p> :
        isLoading ? <p>Calculating charges…</p> : error ? <p role="alert">Could not load the monthly report: {String(error)}</p> : report && <>
          <p>Through {report.throughDate} · Priced total: <strong>{money(selectedReportContract?.amountCents || 0)}</strong>
            {selectedReportContract && selectedReportContract.unpricedHeadDays > 0 &&
              ` · ${selectedReportContract.unpricedHeadDays} head-days need a rate`}</p>
          {!selectedReportContract && <p className="text-sm text-muted-foreground">Select a contract to view its monthly charges.</p>}
          {report.contracts.filter((contract) => contract.id === selectedContractId).map((contract) => <section key={contract.id} className="rounded-md border p-4 space-y-3">
            <div><h2 className="font-semibold">{contract.name}</h2><p className="text-sm text-muted-foreground">
              {contract.rows.length} {contract.rows.length === 1 ? "animal" : "animals"} listed · {contract.ownerName} · {contract.kind === "dairy" ? "Dairy grazing" : "Assigned animals"}
            </p></div>
            <p><strong>{contract.headDays}</strong> head-days · <strong>{money(contract.amountCents)}</strong>
              {contract.unpricedHeadDays > 0 && ` · ${contract.unpricedHeadDays} unpriced head-days`}</p>
            <p className="text-sm text-muted-foreground">Note: Animals currently assigned to “Missing” are excluded from animal detail, head-days, and charges.</p>
            {contract.kind === "dairy" && !contract.dairyBarnFieldId && <p role="alert" className="text-amber-700">Select the Dairy Barn field in this contract to clear the setup warning.</p>}
            {contract.rows.length > 0 && <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="border-b text-left"><th className="p-2">Animal</th><th className="p-2">Phenotype</th><th className="p-2">Type</th><th className="p-2">Sex</th><th className="p-2">Date of birth</th><th className="p-2 text-right">Head-days</th><th className="p-2 text-right">Charge</th></tr></thead>
              <tbody>{contract.rows.map((row) => <tr key={row.animalId} className="border-b">
                <td className="p-2"><Link href={`/animals?animalId=${row.animalId}`}>{row.tagNumber}</Link></td>
                <td className="p-2">{row.phenotype || "—"}</td><td className="p-2">{row.type}</td>
                <td className="p-2">{row.sex}</td><td className="p-2 whitespace-nowrap">{row.dateOfBirth || "—"}</td>
                <td className="p-2 text-right">{row.headDays}</td><td className="p-2 text-right">{money(row.amountCents)}
                  {row.unpricedHeadDays > 0 && <span className="block text-xs text-amber-700">{row.unpricedHeadDays} unpriced days</span>}</td>
              </tr>)}</tbody></table></div>}
          </section>)}
          <details className="rounded-md border p-4">
            <summary className="cursor-pointer font-semibold">Warnings ({selectedWarnings.length})</summary>
            <p className="mt-2 text-sm text-muted-foreground">Review these warnings; some records may need correction. Days with a known location outside Dairy Barn still count as grazing. Overlapping contracts charge an animal only once.</p>
            {selectedWarnings.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No warnings for this month.</p> :
              <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left">
                <th className="p-2">Animal</th><th className="p-2">Issue</th><th className="p-2">Dates</th><th className="p-2 text-right">Days</th></tr></thead>
                <tbody>{selectedWarnings.map((issue, index) => <tr key={`${issue.animalId}-${issue.code}-${index}`} className="border-b">
                  <td className="p-2"><Link href={`/animals?animalId=${issue.animalId}&edit=1`}>{issue.tagNumber}</Link></td>
                  <td className="p-2">{issueLabel(issue.code)}
                    {issueDetails[issue.code] && <span className="block text-xs text-muted-foreground">{issueDetails[issue.code]?.description}</span>}
                    <span className="block text-xs text-muted-foreground">{issue.contractIds.map((id) =>
                      report.contracts.find((contract) => contract.id === id)?.name || id).join(" · ")}</span></td>
                  <td className="p-2">{issue.firstDate}{issue.lastDate !== issue.firstDate && ` – ${issue.lastDate}`}</td>
                  <td className="p-2 text-right">{issue.days}</td></tr>)}</tbody></table></div>}
          </details>
        </>}
    </CardContent></Card>
    <Dialog open={contractDialogOpen} onOpenChange={setContractDialogOpen}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Contracts and rules</DialogTitle>
          <DialogDescription>Edit contract rules and dated $/head/day rates, or add a new contract.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
        <div className="flex flex-wrap gap-2">{contracts.map((contract) => <Button key={contract.id} variant={contractForm.id === contract.id ? "default" : "outline"} onClick={() => { setContractForm(contract); setRateForm(emptyRate()); }}>{contract.name}</Button>)}</div>
        <Button variant="ghost" onClick={() => { setContractForm(emptyContract()); setRateForm(emptyRate()); }}>New contract</Button>
        <div className="space-y-1"><Label htmlFor="contract-name">Contract name</Label><Input id="contract-name" value={contractForm.name} onChange={(event) => setContractForm({ ...contractForm, name: event.target.value })} /></div>
        <div className="space-y-1"><Label htmlFor="contract-owner">Customer owner</Label><select id="contract-owner" className="w-full rounded-md border p-2" value={contractForm.ownerId} onChange={(event) => setContractForm({ ...contractForm, ownerId: event.target.value })}>
          {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</select></div>
        <div className="space-y-1"><Label htmlFor="contract-kind">Service type</Label><select id="contract-kind" className="w-full rounded-md border p-2" value={contractForm.kind} onChange={(event) => setContractForm({ ...contractForm, kind: event.target.value as "dairy" | "general" })}>
          <option value="general">Assigned animals, all active days</option><option value="dairy">Dairy grazing outside Dairy Barn</option></select></div>
        <div className="grid grid-cols-2 gap-2"><div className="space-y-1"><Label htmlFor="contract-from">Starts</Label><Input id="contract-from" type="date" value={contractForm.activeFrom} onChange={(event) => setContractForm({ ...contractForm, activeFrom: event.target.value })} /></div>
          <div className="space-y-1"><Label htmlFor="contract-to">Ends (optional)</Label><Input id="contract-to" type="date" value={contractForm.activeTo || ""} onChange={(event) => setContractForm({ ...contractForm, activeTo: event.target.value || null })} /></div></div>
        {contractForm.kind === "dairy" && <div className="space-y-1"><Label htmlFor="dairy-barn">Dairy Barn field</Label><select id="dairy-barn" className="w-full rounded-md border p-2" value={contractForm.dairyBarnFieldId || ""} onChange={(event) => setContractForm({ ...contractForm, dairyBarnFieldId: event.target.value || null })}>
          <option value="">Choose Dairy Barn</option>{fields.map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}</select></div>}
        <Button disabled={!contractForm.name.trim() || !contractForm.ownerId || !contractForm.activeFrom} onClick={saveContract}>Save contract</Button>
        <div className="space-y-3 border-t pt-4">
          <h3 className="font-semibold">Contract rates</h3>
          <p className="text-sm text-muted-foreground">Each base rate and optional seasonal rule starts on its effective date and continues until the next change. Rates before a change stay in history.</p>
          {!contractForm.id ? <p className="text-sm text-muted-foreground">Save the contract before adding its rate.</p> : <>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1"><Label htmlFor="rate-effective-date">Effective date</Label>
                <Input id="rate-effective-date" type="date" min="2015-01-01" value={rateForm.effectiveDate}
                  onChange={(event) => setRateForm({ ...rateForm, effectiveDate: event.target.value })} /></div>
              <div className="space-y-1"><Label htmlFor="rate-amount">Base $/head/day</Label>
                <Input id="rate-amount" className="w-32" inputMode="decimal" value={rateForm.rate}
                  onChange={(event) => setRateForm({ ...rateForm, rate: event.target.value })} placeholder="0.00" /></div>
            </div>
            <div className="space-y-1"><Label htmlFor="rate-free-under">Free below age (months, optional)</Label>
              <Input id="rate-free-under" type="number" min="1" max="240" className="w-32"
                value={rateForm.freeUnderMonths} onChange={(event) => setRateForm({ ...rateForm, freeUnderMonths: event.target.value })} />
              <p className="text-sm text-muted-foreground">Animals younger than this age count as grazing days at $0. The paid rate starts on the age anniversary.</p></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rateForm.seasonEnabled}
              onChange={(event) => setRateForm({ ...rateForm, seasonEnabled: event.target.checked })} />Seasonal age rates</label>
            {rateForm.seasonEnabled && <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm text-muted-foreground">Seasonal rates replace the base rate during the selected months. The age tier is checked each grazing day; an unknown birth date uses the older tier.</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label htmlFor="rate-season-start">From month</Label><select id="rate-season-start" className="w-full rounded-md border bg-background p-2" value={rateForm.seasonStartMonth} onChange={(event) => setRateForm({ ...rateForm, seasonStartMonth: event.target.value })}>{monthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></div>
                <div className="space-y-1"><Label htmlFor="rate-season-end">Through month</Label><select id="rate-season-end" className="w-full rounded-md border bg-background p-2" value={rateForm.seasonEndMonth} onChange={(event) => setRateForm({ ...rateForm, seasonEndMonth: event.target.value })}>{monthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></div>
              </div>
              <div className="space-y-1"><Label htmlFor="rate-age-threshold">Age threshold (months)</Label><Input id="rate-age-threshold" type="number" min="1" max="240" className="w-32" value={rateForm.ageThresholdMonths} onChange={(event) => setRateForm({ ...rateForm, ageThresholdMonths: event.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label htmlFor="rate-younger">Threshold or younger $/head/day</Label><Input id="rate-younger" inputMode="decimal" value={rateForm.youngerRate} onChange={(event) => setRateForm({ ...rateForm, youngerRate: event.target.value })} placeholder="0.00" /></div>
                <div className="space-y-1"><Label htmlFor="rate-older">Over threshold $/head/day</Label><Input id="rate-older" inputMode="decimal" value={rateForm.olderRate} onChange={(event) => setRateForm({ ...rateForm, olderRate: event.target.value })} placeholder="0.00" /></div>
              </div>
            </div>}
            {rateForm.seasonEnabled && rateForm.freeUnderMonths !== "" &&
              Number(rateForm.freeUnderMonths) > Number(rateForm.ageThresholdMonths) &&
              <p role="alert" className="text-sm text-destructive">The free age cutoff must be at or below the seasonal age threshold.</p>}
            <div className="flex flex-wrap gap-2"><Button disabled={rateBusy || !isServiceDate(rateForm.effectiveDate) || rateForm.effectiveDate < "2015-01-01" ||
              !validAmount(rateForm.rate) || (rateForm.freeUnderMonths !== "" && (!Number.isInteger(Number(rateForm.freeUnderMonths)) || Number(rateForm.freeUnderMonths) < 1 || Number(rateForm.freeUnderMonths) > 240)) ||
              (rateForm.seasonEnabled && rateForm.freeUnderMonths !== "" && Number(rateForm.freeUnderMonths) > Number(rateForm.ageThresholdMonths)) ||
              (rateForm.seasonEnabled && (!validAmount(rateForm.youngerRate) || !validAmount(rateForm.olderRate) ||
                !Number.isInteger(Number(rateForm.ageThresholdMonths)) || Number(rateForm.ageThresholdMonths) < 1 || Number(rateForm.ageThresholdMonths) > 240))}
              onClick={saveRate}>{rateForm.originalDate ? "Update rate" : "Add rate"}</Button>
              {rateForm.originalDate && <Button variant="ghost" onClick={() => setRateForm(rates.length ? { ...formFromRate(rates.at(-1)!, ""), effectiveDate: serviceToday() } : emptyRate())}>Cancel edit</Button>}
              {!rateForm.originalDate && rates.length > 0 && <Button variant="outline" onClick={() => setRateForm({ ...formFromRate(rates.at(-1)!, ""), effectiveDate: serviceToday() })}>New rate from latest</Button>}
            </div>
            <div className="space-y-1">{rates.length === 0 ? <p className="text-sm text-muted-foreground">No rate set yet.</p> :
              rates.map((rate, index) => <div key={rate.effectiveDate} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm">
                <span><strong>{money(rate.rateCents)}/head/day base</strong> from {rate.effectiveDate}
                  {rates[index + 1] ? ` through ${addServiceDays(rates[index + 1].effectiveDate, -1)}` : " onward"}
                  {rate.freeUnderMonths != null && <span className="block text-muted-foreground">Free below {rate.freeUnderMonths} months (counted at $0)</span>}
                  {rate.seasonStartMonth != null && <span className="block text-muted-foreground">{monthNames[rate.seasonStartMonth - 1]}–{monthNames[(rate.seasonEndMonth ?? 3) - 1]}: over {rate.ageThresholdMonths} months {money(rate.olderRateCents ?? 0)}/head/day; {rate.ageThresholdMonths} months or younger {money(rate.youngerRateCents ?? 0)}/head/day</span>}</span>
                <div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => setRateForm(formFromRate(rate))}>Edit</Button>
                  <Button size="sm" variant="outline" onClick={() => run(async () => {
                    await apiRequest("DELETE", `${rateUrl}/${rate.effectiveDate}`);
                    queryClient.invalidateQueries({ queryKey: [rateUrl] });
                    if (rateForm.originalDate === rate.effectiveDate) setRateForm(emptyRate(true));
                  }, "Rate removed")}>Remove</Button></div>
              </div>)}</div>
          </>}
        </div>
        </div>
      </DialogContent>
    </Dialog>
    <Dialog open={ownerDialogOpen} onOpenChange={setOwnerDialogOpen}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Owners and animal assignments</DialogTitle>
          <DialogDescription>Add an owner or manage dated assignments for a general grazing contract.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
        <div className="space-y-1"><p className="text-sm font-medium">Owners</p>
          <div className="flex flex-wrap gap-2">{owners.map((owner) =>
            <span key={owner.id} className="rounded border px-2 py-1 text-sm">{owner.name}</span>)}</div></div>
        <div className="space-y-1"><Label htmlFor="new-owner">New owner</Label><div className="flex gap-2"><Input id="new-owner" value={ownerName} onChange={(event) => setOwnerName(event.target.value)} placeholder="Owner name" />
          <Button variant="outline" disabled={!ownerName.trim()} onClick={() => run(async () => {
            await apiRequest("POST", "/api/grazing-services/owners", { name: ownerName }); setOwnerName("");
          }, "Owner added")}>Add</Button></div></div>
        <p className="text-sm text-muted-foreground">Set or correct an animal’s dated owner in its animal editor.</p>
        <div className="space-y-1"><Label htmlFor="assignment-contract">General contract</Label><select id="assignment-contract" className="w-full rounded-md border p-2" value={assignmentForm.contractId}
          onChange={(event) => setAssignmentForm({ id: "", contractId: event.target.value, animalId: "", startDate: serviceToday(), endDate: "" })}>
          <option value="">Choose contract</option>{generalContracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.name}</option>)}</select></div>
        {assignmentForm.contractId && <>
          <div className="space-y-1"><Label htmlFor="assignment-animal">Animal</Label><select id="assignment-animal" className="w-full rounded-md border p-2" value={assignmentForm.animalId} onChange={(event) => setAssignmentForm({ ...assignmentForm, animalId: event.target.value })}>
            <option value="">Choose animal</option>{animals.slice().sort((a, b) => a.tagNumber.localeCompare(b.tagNumber)).map((animal) => <option key={animal.id} value={animal.id}>{animal.tagNumber}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-2"><div className="space-y-1"><Label htmlFor="assignment-start">Starts</Label><Input id="assignment-start" type="date" value={assignmentForm.startDate} onChange={(event) => setAssignmentForm({ ...assignmentForm, startDate: event.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="assignment-end">Ends (optional)</Label><Input id="assignment-end" type="date" value={assignmentForm.endDate} onChange={(event) => setAssignmentForm({ ...assignmentForm, endDate: event.target.value })} /></div></div>
          <Button disabled={!assignmentForm.animalId || !assignmentForm.startDate} onClick={saveAssignment}>{assignmentForm.id ? "Update assignment" : "Add assignment"}</Button>
          <div className="space-y-1">{assignments.map((assignment) => <div key={assignment.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm">
            <span>{assignment.tagNumber}: {assignment.startDate}{assignment.endDate && ` – ${assignment.endDate}`}</span>
            <div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => setAssignmentForm({ ...assignmentForm, id: assignment.id,
              animalId: assignment.animalId, startDate: assignment.startDate, endDate: assignment.endDate || "" })}>Edit</Button>
              <Button size="sm" variant="outline" onClick={() => run(async () => { await apiRequest("DELETE", `/api/grazing-services/assignments/${assignment.id}`); }, "Assignment removed")}>Remove</Button></div>
          </div>)}</div>
        </>}
        </div>
      </DialogContent>
    </Dialog>
  </div>;
}

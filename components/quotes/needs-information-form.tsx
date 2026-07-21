"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Save } from "lucide-react";

import { completeMissingInformation } from "@/app/quotes/[quoteId]/needs-information/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DashboardButton } from "@/components/app-shell/dashboard-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getMissingFieldDefinition, normalizeMissingFieldPath, type NormalizedMissingField } from "@/lib/rules/missing-information-rules";
import type { InternalQuoteWorkspaceViewModel } from "@/lib/services/quote-workspace-query-service";

type Candidate = { id: string; sku: string; name: string; status?: string };
type Props = { quote: InternalQuoteWorkspaceViewModel };

const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const asArray = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
const fieldValue = (field: unknown) => { const value = asRecord(field).value; return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : ""; };
const answerTypeFor = (record: Record<string, unknown>, field: string) => {
  const explicit = typeof record.answerType === "string" ? record.answerType : typeof record.answer_type === "string" ? record.answer_type : null;
  if (explicit) return explicit;
  const definition = getMissingFieldDefinition(field);
  if (definition?.unit === "percent") return "percentage";
  if (definition?.control === "number") return "number";
  if (definition?.control === "date") return "date";
  if (definition?.control === "select") return "select";
  if (definition?.control === "textarea") return "textarea";
  return "text";
};

const collectMissingFields = (quote: InternalQuoteWorkspaceViewModel): NormalizedMissingField[] => {
  const explicit = quote.reviewMetadata.missingFields.map(normalizeMissingFieldPath);
  const extractionFields = asRecord(quote.reviewMetadata.extractionFields);
  for (const [key, value] of Object.entries(extractionFields)) {
    if (asRecord(value).missing === true) explicit.push(key);
  }
  asArray(extractionFields.requested_items).forEach((item, index) => {
    for (const [key, value] of Object.entries(item)) if (asRecord(value).missing === true) explicit.push(`requested_items[${index}].${key}`);
  });
  for (const ambiguity of asArray(asRecord(quote.reviewMetadata.extraction).ambiguities)) {
    if (typeof ambiguity.field === "string") explicit.push(ambiguity.field);
  }
  if (quote.reviewMetadata.manualEntry.enabled && explicit.length === 0) explicit.push("requested_items[0].requested_sku", "requested_items[0].quantity", "delivery_location", "delivery_date");
  return [...new Set(explicit)].map(getMissingFieldDefinition).filter((field): field is NormalizedMissingField => Boolean(field));
};

const candidatesForItem = (quote: InternalQuoteWorkspaceViewModel, index: number): Candidate[] => {
  const requirementItems = asArray(asRecord(quote.reviewMetadata.requirements.requirements).requested_items);
  const fromRequirement = asArray(requirementItems[index]?.candidates);
  const fromLine = asArray(quote.lines[index]?.internalNotes).concat(asArray((quote.lines[index]?.internalNotes as Record<string, unknown> | undefined)?.candidates));
  return [...fromRequirement, ...fromLine].map((candidate) => ({ id: String(candidate.id ?? ""), sku: String(candidate.sku ?? ""), name: String(candidate.name ?? candidate.description ?? ""), status: typeof candidate.status === "string" ? candidate.status : undefined })).filter((candidate) => candidate.id && candidate.sku);
};

const existingValue = (quote: InternalQuoteWorkspaceViewModel, field: NormalizedMissingField) => {
  const fields = asRecord(quote.reviewMetadata.extractionFields);
  if (field.itemIndex != null) return fieldValue(asArray(fields.requested_items)[field.itemIndex]?.[field.path.split(".").at(-1) ?? ""]);
  return fieldValue(fields[field.path]);
};

export function NeedsInformationForm({ quote }: Props) {
  const router = useRouter();
  const missingFields = collectMissingFields(quote);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [savedIntent, setSavedIntent] = useState<"draft" | "dashboard" | null>(null);
  useEffect(() => { if (savedIntent === "dashboard") router.push("/quotes"); }, [savedIntent, router]);
  const productIndexes = [...new Set(missingFields.filter((field) => field.path.startsWith("requested_items[")).map((field) => field.itemIndex).filter((index): index is number => index != null))]
    .filter((index) => candidatesForItem(quote, index).length > 1 || quote.lines[index]?.productId == null);

  const submit = (fallbackIntent: "continue" | "draft" | "dashboard") => (formData: FormData) => {
    const intent = (formData.get("intent") === "dashboard" ? "dashboard" : fallbackIntent) as "continue" | "draft" | "dashboard";
    const fields: Record<string, string> = {};
    const clarificationAnswers: Record<string, string | number | boolean | null> = {};
    const productSelections: Record<string, { productId: string | null; sku?: string | null; description?: string | null; unresolved?: boolean }> = {};
    for (const [key, value] of formData.entries()) {
      const text = String(value);
      if (key.startsWith("field:")) fields[key.slice(6)] = text;
      if (key.startsWith("clarification:")) clarificationAnswers[key.slice(14)] = value === "true" ? true : value === "false" ? false : text;
      if (key.startsWith("product:")) {
        const path = key.slice(8);
        if (text === "__unresolved") productSelections[path] = { productId: null, unresolved: true };
        else {
          const candidate = candidatesForItem(quote, Number(/requested_items\[(\d+)\]/.exec(path)?.[1] ?? 0)).find((item) => item.id === text);
          productSelections[path] = { productId: text, sku: candidate?.sku ?? null, description: candidate?.name ?? null };
        }
      }
    }
    startTransition(async () => {
      setSavedIntent(null);
      const result = await completeMissingInformation({ quoteId: quote.id, intent, fields, clarificationAnswers, productSelections });
      if (!result.ok) setErrors(result.fieldErrors); else if (intent === "dashboard") setSavedIntent("dashboard"); else if (intent === "draft") setSavedIntent("draft");
    });
  };

  return <form id={`needs-information-${quote.id}`} action={submit("continue")} className="space-y-6">
    {quote.reviewMetadata.manualEntry.enabled && <Alert className="border-amber-300 bg-amber-50"><AlertTriangle className="h-4 w-4 text-amber-600" /><AlertTitle>Manual-entry path enabled</AlertTitle><AlertDescription>Validated extraction may still require customer clarification. Enter only customer-provided facts; pricing, inventory, and approvals remain outside this step.</AlertDescription></Alert>}
    <Card><CardHeader><CardTitle>Information requiring attention</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
      {missingFields.map((field) => <label className="space-y-2 text-sm font-medium" key={field.path}>{field.label}{field.itemIndex != null ? ` (item ${field.itemIndex + 1})` : ""}
        {field.control === "textarea" ? <Textarea name={`field:${field.path}`} defaultValue={existingValue(quote, field)} /> : field.control === "select" ? <Select name={`field:${field.path}`} defaultValue={existingValue(quote, field)}><SelectTrigger><SelectValue placeholder="Select an option" /></SelectTrigger><SelectContent><SelectItem value="customer_installed">Customer installed</SelectItem><SelectItem value="vendor_installation_requested">Vendor installation requested</SelectItem><SelectItem value="not_required">Not required</SelectItem></SelectContent></Select> : <Input name={`field:${field.path}`} type={field.control === "number" ? "number" : field.control === "date" ? "date" : "text"} defaultValue={existingValue(quote, field)} />}
        {errors[field.path] && <span className="text-xs text-red-600">{errors[field.path]}</span>}
      </label>)}
    </CardContent></Card>
    {quote.reviewMetadata.clarificationQuestions.length > 0 && <Card><CardHeader><CardTitle>Clarification questions</CardTitle></CardHeader><CardContent className="space-y-4">{quote.reviewMetadata.clarificationQuestions.map((question, index) => { const record = asRecord(question); const field = String(record.field ?? `question_${index}`); const type = answerTypeFor(record, field); const definition = getMissingFieldDefinition(field); const name = `clarification:${field}`; return <div className="block space-y-2 text-sm font-medium" key={`${field}-${index}`}><div>{String(record.question ?? definition?.label ?? "Clarification needed")}</div>{type === "boolean" ? <div className="flex gap-4"><label><input type="radio" name={name} value="true" /> Yes</label><label><input type="radio" name={name} value="false" /> No</label></div> : type === "percentage" ? <div className="flex items-center gap-2"><Input name={name} type="number" min={definition?.minimum ?? 0} max={definition?.maximum ?? 100} step={definition?.step ?? 0.1} /><span>%</span></div> : type === "number" ? <Input name={name} type="number" min={definition?.minimum} max={definition?.maximum} step={definition?.step} /> : type === "date" ? <Input name={name} type="date" /> : type === "select" ? <Select name={name}><SelectTrigger><SelectValue placeholder="Select an option" /></SelectTrigger><SelectContent>{(Array.isArray(record.options) ? record.options.map(asRecord) : []).map((option) => <SelectItem key={String(option.value)} value={String(option.value)}>{String(option.label ?? option.value)}</SelectItem>)}</SelectContent></Select> : type === "text" ? <Input name={name} type="text" /> : <Textarea name={name} />}{definition?.helpText ? <p className="text-xs text-slate-500">{definition.helpText}</p> : null}</div>; })}</CardContent></Card>}
    {productIndexes.length > 0 && <Card><CardHeader><CardTitle>Product candidate selection</CardTitle></CardHeader><CardContent className="space-y-4">{productIndexes.map((index) => <label className="block space-y-2 text-sm font-medium" key={index}>Catalog product for item {index + 1}<Select name={`product:requested_items[${index}]`}><SelectTrigger><SelectValue placeholder="Select catalog candidate or mark unresolved" /></SelectTrigger><SelectContent>{candidatesForItem(quote, index).map((candidate) => <SelectItem key={candidate.id} value={candidate.id}>{candidate.sku} — {candidate.name}</SelectItem>)}<SelectItem value="__unresolved">Mark unresolved</SelectItem></SelectContent></Select>{errors[`requested_items[${index}]`] && <span className="text-xs text-red-600">{errors[`requested_items[${index}]`]}</span>}</label>)}</CardContent></Card>}
    <div className="flex flex-wrap gap-3"><DashboardButton mode="submit-form" formId={`needs-information-${quote.id}`} disabled={isPending} /><Button className="bg-blue-600 hover:bg-blue-700" disabled={isPending} type="submit"><Save className="mr-2 h-4 w-4" />Save and Continue to Configuration</Button><Button disabled={isPending} formAction={submit("draft")} type="submit" variant="outline">Save Draft</Button></div>{savedIntent === "draft" ? <p className="text-sm text-emerald-700">Draft saved.</p> : null}
  </form>;
}

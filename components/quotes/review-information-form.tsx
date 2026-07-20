"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Plus, Save, Trash2 } from "lucide-react";

import { saveReviewInformation } from "@/app/quotes/[quoteId]/review/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getReviewFieldDefinition } from "@/lib/rules/review-field-registry";
import type { InternalQuoteWorkspaceViewModel } from "@/lib/services/quote-workspace-query-service";

type Props = { quote: InternalQuoteWorkspaceViewModel };
const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const asArray = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
const fieldValue = (field: unknown) => { const value = asRecord(field).value; return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : ""; };
const fieldMeta = (quote: InternalQuoteWorkspaceViewModel, path: string) => {
  const extraction = asRecord(quote.reviewMetadata.extraction);
  const fields = asRecord(quote.reviewMetadata.extractionFields);
  const def = getReviewFieldDefinition(path);
  const source = def?.itemIndex != null ? asRecord(asArray(fields.requested_items)[def.itemIndex]?.[path.split(".").at(-1) ?? ""]) : asRecord(fields[path]);
  const confidence = asRecord(extraction.field_confidence)[path];
  const ambiguity = asArray(extraction.ambiguities).find((a) => a.field === path || a.path === path);
  return { confidence: typeof confidence === "number" ? confidence : typeof source.confidence === "number" ? source.confidence : null, sourceSpan: source.source_span ?? source.source, ambiguity };
};
const existingValue = (quote: InternalQuoteWorkspaceViewModel, path: string) => {
  const fields = asRecord(quote.reviewMetadata.extractionFields);
  const def = getReviewFieldDefinition(path);
  if (path === "currency") return quote.currencyCode;
  if (def?.itemIndex != null) return fieldValue(asArray(fields.requested_items)[def.itemIndex]?.[path.split(".").at(-1) ?? ""]);
  return fieldValue(fields[path]);
};
function StatusIndicators({ quote, path }: { quote: InternalQuoteWorkspaceViewModel; path: string }) {
  const def = getReviewFieldDefinition(path);
  const value = existingValue(quote, path);
  const meta = fieldMeta(quote, path);
  return <div className="flex flex-wrap gap-1 text-xs"><Badge variant="outline">{value ? "Extracted" : "System default"}</Badge>{def?.requiredForConfiguration && <Badge className="bg-amber-100 text-amber-800">Required</Badge>}{meta.confidence != null && <Badge variant="outline">Confidence {Math.round(meta.confidence * 100)}%</Badge>}{meta.sourceSpan ? <Badge variant="outline">Source available</Badge> : null}</div>;
}
function Field({ quote, path, name }: { quote: InternalQuoteWorkspaceViewModel; path: string; name?: string }) {
  const def = getReviewFieldDefinition(path)!;
  const value = existingValue(quote, path);
  const meta = fieldMeta(quote, path);
  const inputName = name ?? `field:${path}`;
  return <label className="space-y-2 text-sm font-medium">{def.label}<StatusIndicators quote={quote} path={path} />{def.control === "textarea" ? <Textarea name={inputName} defaultValue={value} placeholder={def.helpText} /> : def.control === "select" ? <Select name={inputName} defaultValue={value || String(def.defaultValue ?? "not_required")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{def.options?.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select> : <Input name={inputName} type={def.control === "number" || def.control === "percentage" ? "number" : def.control === "date" ? "date" : "text"} defaultValue={value} min={def.minimum} max={def.maximum} step={def.step} placeholder={def.helpText} />}{def.helpText ? <p className="text-xs text-slate-500">{def.helpText}</p> : null}{meta.ambiguity ? <p className="text-xs text-amber-700">Ambiguity: {String(asRecord(meta.ambiguity).explanation ?? asRecord(meta.ambiguity).reason ?? "Review this value.")}</p> : null}</label>;
}
export function ReviewInformationForm({ quote }: Props) {
  const initialCount = Math.max(1, asArray(asRecord(quote.reviewMetadata.extractionFields).requested_items).length, quote.lines.length);
  const [rows, setRows] = useState([...Array(initialCount)].map((_, i) => i));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const submit = (intent: "continue" | "draft") => (formData: FormData) => {
    const fields: Record<string, string> = {};
    for (const [key, value] of formData.entries()) if (key.startsWith("field:")) fields[key.slice(6)] = String(value);
    startTransition(async () => { const result = await saveReviewInformation({ quoteId: quote.id, intent, fields }); if (!result.ok) setErrors(result.fieldErrors); });
  };
  return <form action={submit("continue")} className="space-y-6">
    {quote.reviewMetadata.manualEntry.enabled && <Alert className="border-amber-300 bg-amber-50"><AlertTriangle className="h-4 w-4 text-amber-600" /><AlertTitle>Manual-entry mode enabled</AlertTitle><AlertDescription>Manual entry is enabled only for technical extraction failure or truly missing required facts. Ambiguous or unresolved business data remains reviewable without treating AI extraction as failed.</AlertDescription></Alert>}
    <Card><CardHeader><CardTitle>Customer and opportunity</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><Field quote={quote} path="customer_name" /><Field quote={quote} path="opportunity_name" /><Field quote={quote} path="currency" />{errors.customer_name || errors.currency ? <p className="text-sm text-red-600">{errors.customer_name ?? errors.currency}</p> : null}</CardContent></Card>
    <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle>Requested items</CardTitle><Button type="button" variant="outline" onClick={() => setRows((r) => [...r, (r.at(-1) ?? -1) + 1])}><Plus className="mr-2 h-4 w-4" />Add item</Button></CardHeader><CardContent className="space-y-6">{errors.requested_items && <p className="text-sm text-red-600">{errors.requested_items}</p>}{rows.map((index) => <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-2" key={index}><div className="md:col-span-2 flex justify-between"><h3 className="font-semibold">Item {index + 1}</h3>{rows.length > 1 && <Button type="button" variant="outline" onClick={() => setRows((r) => r.filter((row) => row !== index))}><Trash2 className="h-4 w-4" /></Button>}</div><Field quote={quote} path={`requested_items[${index}].raw_item_description`} /><Field quote={quote} path={`requested_items[${index}].requested_sku`} /><Field quote={quote} path={`requested_items[${index}].quantity`} /><Field quote={quote} path={`requested_items[${index}].specifications`} />{errors[`requested_items[${index}].raw_item_description`] || errors[`requested_items[${index}].quantity`] ? <p className="text-sm text-red-600 md:col-span-2">{errors[`requested_items[${index}].raw_item_description`] ?? errors[`requested_items[${index}].quantity`]}</p> : null}</div>)}</CardContent></Card>
    <Card><CardHeader><CardTitle>Commercial requirements</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><Field quote={quote} path="requested_discount" /><Field quote={quote} path="installation_requirement" />{errors.requested_discount && <p className="text-sm text-red-600">{errors.requested_discount}</p>}</CardContent></Card>
    <Card><CardHeader><CardTitle>Delivery and additional requirements</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><Field quote={quote} path="delivery_location" /><Field quote={quote} path="delivery_date" /><div className="md:col-span-2"><Field quote={quote} path="special_requirements" /></div>{errors.delivery_location && <p className="text-sm text-red-600">{errors.delivery_location}</p>}</CardContent></Card>
    <div className="flex flex-wrap gap-3"><Button className="bg-blue-600 hover:bg-blue-700" disabled={isPending} type="submit"><Save className="mr-2 h-4 w-4" />Save and Continue to Configuration</Button><Button disabled={isPending} formAction={submit("draft")} type="submit" variant="outline">Save Draft</Button></div>
  </form>;
}

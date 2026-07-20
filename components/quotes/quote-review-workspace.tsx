"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, ClipboardCheck, HelpCircle, PackageSearch, PencilLine, Save, Send, ShieldCheck } from "lucide-react";

import { continueQuoteConfiguration, saveQuoteDraft, applyRepCorrections } from "@/app/quotes/[quoteId]/actions";
import { WorkspaceGrid } from "@/components/app-shell/workspace-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { InternalQuoteWorkspaceViewModel } from "@/lib/services/quote-workspace-query-service";

type Props = { quote: InternalQuoteWorkspaceViewModel };
type JsonObject = Record<string, unknown>;

const actorId = null;
const asObject = (value: unknown): JsonObject => (value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {});
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const text = (value: unknown, fallback = "Not provided") => (typeof value === "string" && value.trim() ? value : fallback);
const confidencePercent = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? Math.round(value * 100) : null);
const fieldValue = (field: unknown, fallback = "Missing") => {
  const object = asObject(field);
  if ("value" in object) return object.value == null || object.value === "" ? fallback : String(object.value);
  return field == null || field === "" ? fallback : String(field);
};
const fieldConfidence = (metadata: Props["quote"]["reviewMetadata"], key: string) => {
  const direct = asObject(metadata.fieldConfidence)[key];
  const field = asObject(asObject(metadata.extractionFields)[key]);
  return confidencePercent(direct ?? field.confidence ?? asObject(field.value).confidence);
};
const serializeLines = (quote: InternalQuoteWorkspaceViewModel) => quote.lines.map((line) => ({
  product_id: line.productId,
  sku: line.sku || "UNMATCHED",
  description: line.description || "Manual entry required",
  quantity: line.quantity,
  unit_price: line.unitPrice,
  discount_bps: line.discountBps,
  metadata: { internal_notes: line.internalNotes, inventory_decision: line.inventoryDecision, unit_cost: line.unitCost },
}));

function ConfidenceBadge({ value }: { value: number | null }) {
  const label = value == null ? "Manual" : `${value}%`;
  const className = value == null || value < 75 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700";
  return <Badge className={className}>{label}</Badge>;
}

function OriginalRequestCard({ quote }: Props) {
  const extraction = quote.reviewMetadata;
  const failure = asObject(extraction.extraction.failure);
  return <Card>
    <CardHeader><CardTitle>Original Request</CardTitle></CardHeader>
    <CardContent className="space-y-3">
      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm leading-6 text-slate-800">{text(extraction.originalRequestText, "No original request was stored. Use the manual-entry fields below to reconstruct the request before configuration.")}</div>
      <div className="flex items-center justify-between text-xs text-slate-500"><span>Extraction status: {text(extraction.extractionStatus, "not run")}</span><ConfidenceBadge value={confidencePercent(asObject(extraction.extractionFields).overall_confidence)} /></div>
      {extraction.manualEntry.enabled ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><div className="font-semibold">Manual entry path enabled</div><p>{text(failure.summary, "Use the editable requirements and line-item fields to reconstruct the quote request before configuration.")}</p><p className="mt-1 text-xs">Failure category: {text(extraction.manualEntry.reason === "extraction_failed" ? failure.category : extraction.manualEntry.reason, "manual_review")}</p></div> : null}
    </CardContent>
  </Card>;
}

function RequirementsEditor({ quote }: Props) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const fields = quote.reviewMetadata.extractionFields;
  return <form action={(formData) => startTransition(async () => {
    setSaved(false);
    await applyRepCorrections({
      quote_id: quote.id,
      actor_id: actorId,
      currency_code: String(formData.get("currency_code") ?? quote.currencyCode),
      valid_until: String(formData.get("valid_until") || quote.validUntil || "") || null,
      metadata: {},
      lines: serializeLines(quote).map((line, index) => index === 0 ? { ...line, quantity: Number(formData.get("quantity") || line.quantity), discount_bps: Number(formData.get("discount_bps") || line.discount_bps) } : line),
      requirements: {
        customer_name: String(formData.get("customer_name") ?? ""),
        delivery_location: String(formData.get("delivery_location") ?? ""),
        installation_requirement: String(formData.get("installation_requirement") ?? "unknown"),
        special_requirements: String(formData.get("special_requirements") ?? ""),
      },
    });
    setSaved(true);
  })} className="space-y-4">
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><PencilLine className="h-5 w-5 text-blue-600" /> Editable Structured Requirements</CardTitle></CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-500">Customer<Input name="customer_name" defaultValue={quote.customer?.name ?? fieldValue(fields.customer_name)} /></label>
        <label className="text-xs font-semibold text-slate-500">Currency<Input name="currency_code" defaultValue={quote.currencyCode} /></label>
        <label className="text-xs font-semibold text-slate-500">Quantity<Input name="quantity" type="number" defaultValue={quote.lines[0]?.quantity ?? 1} /></label>
        <label className="text-xs font-semibold text-slate-500">Required date<Input name="valid_until" type="date" defaultValue={quote.validUntil ?? fieldValue(fields.delivery_date)} /></label>
        <label className="text-xs font-semibold text-slate-500">Requested discount (bps)<Input name="discount_bps" type="number" defaultValue={quote.lines[0]?.discountBps ?? 0} /></label>
        <label className="text-xs font-semibold text-slate-500">Installation required<Select name="installation_requirement" defaultValue={fieldValue(fields.installation_requirement).toLowerCase()}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent><SelectItem value="yes">Yes</SelectItem><SelectItem value="no">No</SelectItem><SelectItem value="unknown">Unknown</SelectItem></SelectContent></Select></label>
        <label className="sm:col-span-2 text-xs font-semibold text-slate-500">Delivery location<Input name="delivery_location" defaultValue={fieldValue(fields.delivery_location)} /></label>
        <label className="sm:col-span-2 text-xs font-semibold text-slate-500">Special requirements<Textarea name="special_requirements" defaultValue={fieldValue(fields.special_requirements, "")} /></label>
        <Button type="submit" disabled={pending} className="sm:col-span-2">{pending ? "Saving review..." : "Save requirement changes"}</Button>
        {saved ? <p className="text-xs text-emerald-600">Requirement changes saved through server action.</p> : null}
      </CardContent>
    </Card>
  </form>;
}

function ConfidencePanel({ quote }: Props) {
  const keys = ["customer_name", "requested_items", "delivery_location", "delivery_date", "requested_discount", "installation_requirement"];
  return <Card><CardHeader><CardTitle>Confidence Indicators</CardTitle></CardHeader><CardContent className="space-y-2">{keys.map((key) => <div key={key} className="flex items-center justify-between rounded-lg border p-2 text-sm"><span className="capitalize">{key.replaceAll("_", " ")}</span><ConfidenceBadge value={fieldConfidence(quote.reviewMetadata, key)} /></div>)}</CardContent></Card>;
}

function MissingInfoCard({ quote }: Props) {
  const missing = quote.reviewMetadata.missingFields.length ? quote.reviewMetadata.missingFields : quote.readiness.blockers.map((b) => b.message);
  return <Card className={missing.length ? "border-amber-200 bg-amber-50/60" : "border-emerald-200 bg-emerald-50/60"}><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" /> Missing Information</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">{missing.length ? missing.map((item, index) => <div key={index} className="rounded-lg bg-white/70 p-2">{String(item).replaceAll("_", " ")}</div>) : <p>Required information is complete.</p>}</CardContent></Card>;
}

function ClarificationsCard({ quote }: Props) {
  const [pending, startTransition] = useTransition();
  const questions = quote.reviewMetadata.clarificationQuestions;
  return <form action={(formData) => startTransition(async () => {
    const clarification_answers = Object.fromEntries(questions.map((question, index) => [text(asObject(question).field, `question_${index + 1}`), String(formData.get(`answer_${index}`) ?? "")]));
    await saveQuoteDraft({ quote_id: quote.id, actor_id: actorId, lines: serializeLines(quote), currency_code: quote.currencyCode, valid_until: quote.validUntil, clarification_answers, metadata: { clarification_answers_saved_at: new Date().toISOString() } });
  })}>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><HelpCircle className="h-5 w-5 text-blue-600" /> Clarification Questions & Answers</CardTitle></CardHeader><CardContent className="space-y-3">{questions.length ? questions.map((question, index) => <label key={index} className="block text-xs font-semibold text-slate-500">{text(asObject(question).question)}<Textarea name={`answer_${index}`} className="mt-1" placeholder="Record customer or rep answer" /></label>) : <p className="text-sm text-slate-500">No clarification questions are open.</p>}<Button type="submit" variant="outline" disabled={pending || !questions.length}>{pending ? "Saving answers..." : "Save clarification answers"}</Button></CardContent></Card>
  </form>;
}

function ProductCandidates({ quote }: Props) {
  const storedCandidates = asArray(quote.reviewMetadata.review.product_candidates);
  const candidates: unknown[] = storedCandidates.length ? storedCandidates : quote.lines;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PackageSearch className="h-5 w-5 text-blue-600" /> Product Candidates
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {candidates.map((candidate, index) => {
          const object = asObject(candidate);
          const fallbackLine = quote.lines[index];
          return (
            <div key={index} className="rounded-xl border p-3 text-sm">
              <div className="font-semibold">
                {text(object.sku ?? object.description ?? fallbackLine?.sku, `Candidate ${index + 1}`)}
              </div>
              <p className="text-slate-600">
                {text(object.description ?? object.reason ?? fallbackLine?.description)}
              </p>
              <div className="mt-2">
                <ConfidenceBadge value={confidencePercent(object.confidence)} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function RepConfirmationAndActions({ quote }: Props) {
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const run = (name: string, action: () => Promise<unknown>) => startTransition(async () => { setPendingAction(name); await action(); setPendingAction(null); });
  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-blue-600" /> Rep Confirmation</CardTitle></CardHeader><CardContent className="space-y-3"><div className="rounded-lg border p-3 text-sm"><ClipboardCheck className="mr-2 inline h-4 w-4 text-emerald-600" />Rep confirms extracted requirements have been reviewed before configuration.</div><Button variant="outline" className="w-full" disabled={isPending} onClick={() => run("save", () => saveQuoteDraft({ quote_id: quote.id, actor_id: actorId, currency_code: quote.currencyCode, valid_until: quote.validUntil, lines: serializeLines(quote), rep_confirmation: { confirmed_at: new Date().toISOString(), confirmed_by: "sales_rep" }, metadata: { saved_from_review: true } }))}><Save className="mr-2 h-4 w-4" />{pendingAction === "save" ? "Saving draft..." : "Save Draft"}</Button><Button className="w-full" disabled={isPending} onClick={() => run("continue", () => continueQuoteConfiguration({ quote_id: quote.id, actor_id: actorId, idempotency_key: `continue-review-${quote.id}` }))}><Send className="mr-2 h-4 w-4" />{pendingAction === "continue" ? "Continuing..." : "Continue to Configuration"}</Button></CardContent></Card>;
}

function ManualEntryNotice({ quote }: Props) {
  if (!quote.reviewMetadata.manualEntry.enabled) return null;
  return <Card className="border-amber-300 bg-amber-50"><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" /> Manual-entry path enabled</CardTitle></CardHeader><CardContent className="text-sm text-amber-900">Extraction failed, returned invalid or malformed output, or left required fields incomplete. Enter and save controlled requirements manually before continuing. Reason: {text(quote.reviewMetadata.manualEntry.reason)}.</CardContent></Card>;
}

export function QuoteReviewWorkspace({ quote }: Props) {
  return (
    <WorkspaceGrid
      left={
        <>
          <OriginalRequestCard quote={quote} />
          <RequirementsEditor quote={quote} />
          <ConfidencePanel quote={quote} />
        </>
      }
      main={
        <>
          <ManualEntryNotice quote={quote} />
          <MissingInfoCard quote={quote} />
          <ClarificationsCard quote={quote} />
          <ProductCandidates quote={quote} />
        </>
      }
      right={<RepConfirmationAndActions quote={quote} />}
    />
  );
}

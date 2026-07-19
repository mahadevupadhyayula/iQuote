"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { applyRepCorrections, continueQuoteConfiguration, saveQuoteDraft, selectFulfillment } from "@/app/quotes/[quoteId]/actions";
import type { InternalQuoteWorkspaceViewModel } from "@/lib/services/quote-workspace-query-service";

type Props = { quote: InternalQuoteWorkspaceViewModel };
const actorId = null;
const serializeLines = (quote: InternalQuoteWorkspaceViewModel) => quote.lines.map((line) => ({
  product_id: line.productId,
  sku: line.sku,
  description: line.description,
  quantity: line.quantity,
  unit_price: line.unitPrice,
  discount_bps: line.discountBps,
  metadata: { internal_notes: line.internalNotes, inventory_decision: line.inventoryDecision, unit_cost: line.unitCost },
}));

export function CorrectionForm({ quote }: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <form className="space-y-3" action={(formData) => startTransition(async () => {
      setMessage(null);
      await applyRepCorrections({
        quote_id: quote.id,
        actor_id: actorId,
        currency_code: String(formData.get("currency_code") ?? quote.currencyCode),
        valid_until: String(formData.get("valid_until") || quote.validUntil || "") || null,
        lines: serializeLines(quote).map((line, index) => index === 0 ? { ...line, discount_bps: Number(formData.get("discount_bps") ?? quote.lines[0]?.discountBps ?? 0) } : line),
        metadata: { correction_note: String(formData.get("correction_note") ?? "") },
      });
      setMessage("Corrections applied.");
    })}>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs font-semibold text-slate-500">Currency<input name="currency_code" defaultValue={quote.currencyCode} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label>
        <label className="text-xs font-semibold text-slate-500">Valid until<input name="valid_until" type="date" defaultValue={quote.validUntil ?? ""} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label>
        <label className="col-span-2 text-xs font-semibold text-slate-500">First-line discount bps<input name="discount_bps" type="number" defaultValue={quote.lines[0]?.discountBps ?? 0} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label>
        <label className="col-span-2 text-xs font-semibold text-slate-500">Correction note<input name="correction_note" placeholder="Clarified scope, discount, or delivery details" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label>
      </div>
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Applying..." : "Apply Corrections"}</Button>
      {message ? <p className="text-xs text-emerald-600">{message}</p> : null}
    </form>
  );
}

export function FulfillmentButton({ quote, lineNumber }: Props & { lineNumber: number }) {
  const [pending, startTransition] = useTransition();
  const line = quote.lines.find((item) => item.lineNumber === lineNumber);
  const productId = line?.productId;
  return <Button variant="outline" size="sm" disabled={pending || !productId} onClick={() => {
    if (!productId) return;
    startTransition(async () => {
      await selectFulfillment({ quote_id: quote.id, actor_id: actorId, line_number: lineNumber });
    });
  }}>{pending ? "Saving..." : "Use recommended"}</Button>;
}

export function QuoteWorkflowActions({ quote }: Props) {
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const run = (name: string, action: () => Promise<unknown>) => startTransition(async () => { setPendingAction(name); await action(); setPendingAction(null); });
  return <div className="space-y-3">
    <Button className="w-full" disabled={isPending} onClick={() => run("continue", () => continueQuoteConfiguration({ quote_id: quote.id, actor_id: actorId, idempotency_key: `continue-${quote.id}` }))}>{pendingAction === "continue" ? "Continuing..." : "Continue"}</Button>
    <Button variant="outline" className="w-full" disabled={isPending} onClick={() => run("save", () => saveQuoteDraft({ quote_id: quote.id, actor_id: actorId, currency_code: quote.currencyCode, valid_until: quote.validUntil, lines: serializeLines(quote), metadata: { saved_from_workspace: true } }))}>{pendingAction === "save" ? "Saving..." : "Save Draft"}</Button>
  </div>;
}

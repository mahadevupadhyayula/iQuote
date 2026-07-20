"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { applyRepCorrections, continueQuoteConfiguration, resolveQuoteLineSelection, saveQuoteDraft, selectFulfillment } from "@/app/quotes/[quoteId]/actions";
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
const disabledReasons = (quote: InternalQuoteWorkspaceViewModel) => {
  if (quote.configuration.canContinue) return [];
  if (quote.configuration.blockers.length > 0) {
    return quote.configuration.blockers.map((blocker) => blocker.message);
  }
  return ["Complete the remaining quote configuration before continuing."];
};

const uniqueFirstThree = (messages: string[]) => [...new Set(messages)].slice(0, 3);

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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const line = quote.lines.find((item) => item.lineNumber === lineNumber);
  const productId = line?.productId;
  if (line?.inventoryApplied && line.inventoryConfirmedAt) return <div className="text-sm font-semibold text-emerald-700"><span aria-label="Applied">✓ Applied</span></div>;
  return <div className="space-y-2"><Button variant="outline" size="sm" disabled={pending || !productId} onClick={() => {
    if (!productId || pending) return;
    startTransition(async () => {
      setError(null);
      try {
        await selectFulfillment({ quote_id: quote.id, actor_id: actorId, line_number: lineNumber });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to apply inventory recommendation.");
      }
    });
  }}>{pending ? "Applying..." : "Use recommended"}</Button>{error ? <p className="text-xs text-red-600" role="alert">{error}</p> : null}</div>;
}

export function LineResolutionControls({ quote, lineNumber }: Props & { lineNumber: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string>(quote.lines.find((item) => item.lineNumber === lineNumber)?.selectedProductId ?? "");
  const [error, setError] = useState<string | null>(null);
  const apply = (mode: "recommended" | "catalogue" | "unavailable", productId?: string) => {
    startTransition(async () => {
      setError(null);
      try {
        await resolveQuoteLineSelection(mode === "catalogue" ? { quote_id: quote.id, actor_id: actorId, line_number: lineNumber, mode, product_id: productId ?? "" } : mode === "unavailable" ? { quote_id: quote.id, actor_id: actorId, line_number: lineNumber, mode } : { quote_id: quote.id, actor_id: actorId, line_number: lineNumber, mode });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to resolve line.");
      }
    });
  };
  return <div className="space-y-2"><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={pending} onClick={() => apply("recommended")}>Use recommendation</Button><select aria-label={`Select catalogue product for line ${lineNumber}`} className="rounded-md border px-2 py-1 text-sm" value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">Select catalogue product</option>{quote.activeCatalogueProducts.map((product) => <option key={product.id} value={product.id}>{product.sku} — {product.name}</option>)}<option value="__not_available__">Not available</option></select><Button variant="outline" size="sm" disabled={pending || !selected} onClick={() => selected === "__not_available__" ? apply("unavailable") : apply("catalogue", selected)}>Apply selection</Button></div>{error ? <p className="text-xs text-red-600" role="alert">{error}</p> : null}</div>;
}

export function QuoteWorkflowActions({ quote }: Props) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const run = (name: string, action: () => Promise<unknown>) => {
    if (isPending) return;
    startTransition(async () => {
      setPendingAction(name);
      setError(null);
      try {
        await action();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : `Unable to ${name}.`);
      } finally {
        setPendingAction(null);
      }
    });
  };
  const reasons = uniqueFirstThree(disabledReasons(quote));
  return <div className="w-full space-y-2 sm:w-auto"><div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button variant="outline" className="w-full sm:w-auto" disabled={isPending} onClick={() => run("save", () => saveQuoteDraft({ quote_id: quote.id, actor_id: actorId, currency_code: quote.currencyCode, valid_until: quote.validUntil, metadata: { saved_from_workspace: true } }))}>{pendingAction === "save" ? "Saving..." : "Save Draft"}</Button><Button className="w-full sm:w-auto" disabled={isPending || !quote.configuration.canContinue} onClick={() => run("continue", () => continueQuoteConfiguration({ quote_id: quote.id, actor_id: actorId, idempotency_key: `continue-${quote.id}` }))}>{pendingAction === "continue" ? "Continuing..." : "Continue"}</Button></div>{reasons.length > 0 ? <div className="space-y-1 text-right text-sm text-slate-600">{reasons.map((reason) => <p key={reason}>{reason}</p>)}</div> : <p className="text-right text-sm text-emerald-700">Configuration complete. Continue will evaluate approval requirements.</p>}{error ? <p className="text-right text-sm text-red-600" role="alert">{error}</p> : null}</div>;
}

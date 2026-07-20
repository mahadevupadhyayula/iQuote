import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FileText, Send } from "lucide-react";
import { SendQuoteForm } from "@/components/quotes/send-quote-form";

import { WorkspaceLayout } from "@/components/app-shell/workspace-layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerSupabaseClient } from "@/lib/db/server";
import { createRepositories } from "@/lib/repositories";
import { createQuoteWorkspaceQueryService } from "@/lib/services/quote-workspace-query-service";

export const dynamic = "force-dynamic";
const currency = (amount: number, code = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(amount);
const percent = (bps: number) => `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`;
const shortDate = (value: string | null) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value)) : "Not set";

export default async function GenerateQuotePage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const repositories = createRepositories(createServerSupabaseClient());
  const quote = await createQuoteWorkspaceQueryService(repositories).getCustomerQuote(quoteId);
  if (!quote) notFound();
  if (!["approved", "sent", "accepted"].includes(quote.status)) redirect(`/quotes/${quoteId}`);

  return (
    <WorkspaceLayout currentStep="generate-quote" status={quote.status} contentClassName="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Generate customer quote</p><h1 className="text-3xl font-bold">{quote.quoteNumber}</h1><p className="text-slate-600">Customer-ready preview for {quote.customer?.name ?? "Unknown customer"}.</p></div><Badge className="bg-white text-sm text-slate-700">{quote.status.replaceAll("_", " ")}</Badge></header>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-blue-600" /> Customer quote preview</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><div><strong>Seller</strong><p>Intelligent Quote Workspace Demo Seller</p></div><div><strong>Customer</strong><p>{quote.customer?.legal_name ?? quote.customer?.name ?? "Unknown customer"}</p></div>{quote.lines.map((line) => <div key={line.id} className="grid grid-cols-5 gap-2 border-b pb-2"><span>{line.sku}</span><span className="col-span-2">{line.quantity} × {line.description}</span><span>{currency(line.unitPrice, quote.currencyCode)} ({percent(line.discountBps)} off)</span><strong>{currency(line.lineTotalAmount, quote.currencyCode)}</strong></div>)}<div><strong>Fulfilment summary</strong><p>Fulfilment will follow the confirmed inventory selection for each quoted product.</p></div></CardContent></Card>
        <Card><CardHeader><CardTitle>Quote totals</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{currency(quote.subtotalAmount, quote.currencyCode)}</span></div><div className="flex justify-between"><span>Discount</span><span>-{currency(quote.discountAmount, quote.currencyCode)}</span></div><div className="flex justify-between"><span>Tax</span><span>{currency(quote.taxAmount, quote.currencyCode)}</span></div><div className="flex justify-between border-t pt-3 text-lg font-bold"><span>Total</span><span>{currency(quote.totalAmount, quote.currencyCode)}</span></div><div className="flex justify-between"><span>Valid until</span><strong>{shortDate(quote.validUntil)}</strong></div><div className="flex justify-between"><span>Payment terms</span><strong>Net terms per account</strong></div></CardContent></Card>
      </div>
      <div className="flex flex-wrap gap-3"><Link href={`/api/quotes/${quote.id}/pdf`} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Generate PDF</Link><span className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"><Send className="h-4 w-4" /> Send quote</span></div><Card><CardHeader><CardTitle>Send quote</CardTitle></CardHeader><CardContent><SendQuoteForm quoteId={quote.id} defaultRecipient={quote.customer?.billing_email} /></CardContent></Card>
    </WorkspaceLayout>
  );
}

import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock3, FileText, PackageCheck, Settings2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createServerSupabaseClient } from "@/lib/db/server";
import { createRepositories } from "@/lib/repositories";
import { createQuoteWorkspaceQueryService, type InternalQuoteWorkspaceViewModel } from "@/lib/services/quote-workspace-query-service";
import { CorrectionForm, FulfillmentButton, QuoteWorkflowActions } from "@/components/quotes/quote-workspace-actions";

const currency = (amount: number, code = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(amount);
const percent = (bps: number) => `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`;
const shortDate = (value: string | null) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value)) : "Not set";
const relativeMinutes = (minutes: number | null) => minutes == null ? "No SLA" : minutes < 0 ? `${Math.abs(minutes)}m breached` : minutes > 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m left` : `${minutes}m left`;

function RequirementsCard({ quote }: { quote: InternalQuoteWorkspaceViewModel }) {
  const address = quote.customer?.shipping_address as Record<string, unknown> | undefined;
  const rows = [
    ["Customer", quote.customer?.name ?? "Unknown"],
    ["Product", quote.lines[0]?.description ?? "No lines"],
    ["Quantity", String(quote.lines.reduce((sum, line) => sum + line.quantity, 0))],
    ["Delivery location", [address?.city, address?.state].filter(Boolean).join(", ") || "Not provided"],
    ["Required date", shortDate(quote.validUntil)],
    ["Requested discount", percent(quote.subtotalAmount ? Math.round((quote.discountAmount / quote.subtotalAmount) * 10_000) : 0)],
  ];
  return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><FileText className="h-5 w-5 text-blue-600" /> Requirements</CardTitle></CardHeader><CardContent className="space-y-3">{rows.map(([label, value]) => <div key={label} className="flex justify-between border-b pb-2 text-sm"><span className="text-slate-500">{label}</span><strong className="text-right text-slate-900">{value}</strong></div>)}<div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800"><AlertTriangle className="mr-2 inline h-4 w-4" />{quote.readiness.blockers.length} readiness items require attention</div></CardContent></Card>;
}

function QuoteConfigurationTable({ quote }: { quote: InternalQuoteWorkspaceViewModel }) {
  return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Settings2 className="h-5 w-5 text-blue-600" /> Quote Configuration</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Qty</TableHead><TableHead>Unit Price</TableHead><TableHead>Availability</TableHead><TableHead>Discount</TableHead><TableHead>Margin</TableHead><TableHead /></TableRow></TableHeader><TableBody>{quote.lines.map((line) => <TableRow key={line.id}><TableCell><div className="font-semibold">{line.description}</div><div className="text-xs text-slate-500">{line.sku}</div></TableCell><TableCell>{line.quantity}</TableCell><TableCell>{currency(line.unitPrice, quote.currencyCode)}</TableCell><TableCell><Badge className="bg-white text-slate-700">{line.inventoryDecision ? "Recommended" : "Unresolved"}</Badge></TableCell><TableCell className={line.discountBps > 1000 ? "text-red-600" : ""}>{percent(line.discountBps)}</TableCell><TableCell className={line.marginFloorPasses ? "text-emerald-600" : "text-amber-600"}>{percent(line.grossMarginBps)}</TableCell><TableCell><FulfillmentButton quote={quote} lineNumber={line.lineNumber} /></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>;
}

function InventoryRecommendation({ quote }: { quote: InternalQuoteWorkspaceViewModel }) {
  return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><PackageCheck className="h-5 w-5 text-blue-600" /> Inventory Recommendation</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{quote.lines.map((line) => <div key={line.id} className="rounded-lg border p-3"><div className="font-semibold">{line.sku}</div><p className="mt-1 text-sm text-slate-600">{line.inventoryDecision ? "Inventory has a saved recommendation. Confirm or replace with the recommended fulfillment choice." : "Run the recommended fulfillment action to resolve inventory for this line."}</p><div className="mt-3"><FulfillmentButton quote={quote} lineNumber={line.lineNumber} /></div></div>)}</CardContent></Card>;
}

function ReadinessPanel({ quote }: { quote: InternalQuoteWorkspaceViewModel }) {
  const checks = quote.readiness.ready ? ["Requirements complete", "Product configuration valid", "Pricing current", "Inventory resolved", "Margin within policy", "Terms accepted"] : quote.readiness.blockers.map((b) => b.message);
  return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><CheckCircle2 className="h-5 w-5 text-blue-600" /> Quote Readiness</CardTitle></CardHeader><CardContent className="space-y-3">{checks.map((check, index) => <div key={index} className="flex gap-2 text-sm"><CheckCircle2 className={`h-5 w-5 ${quote.readiness.ready ? "text-emerald-600" : "text-amber-600"}`} /><span>{check}</span></div>)}</CardContent></Card>;
}

function SummaryAndSla({ quote }: { quote: InternalQuoteWorkspaceViewModel }) {
  return <><Card><CardHeader><CardTitle>Quote Summary</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{currency(quote.subtotalAmount, quote.currencyCode)}</span></div><div className="flex justify-between text-red-600"><span>Discount</span><span>-{currency(quote.discountAmount, quote.currencyCode)}</span></div><div className="flex justify-between border-t pt-3 text-lg font-bold"><span>Total</span><span>{currency(quote.totalAmount, quote.currencyCode)}</span></div><div className="flex justify-between text-emerald-600"><span>Gross margin</span><span>{percent(quote.margin.grossMarginBps)} ({currency(quote.margin.grossProfitAmount, quote.currencyCode)})</span></div></CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-orange-600" /> SLA</CardTitle></CardHeader><CardContent><p className={`text-2xl font-bold ${quote.sla.breached ? "text-red-600" : "text-orange-600"}`}>{relativeMinutes(quote.sla.minutesRemaining)}</p><p className="text-sm text-slate-500">Due {shortDate(quote.sla.dueAt)}</p></CardContent></Card></>;
}

function ActivityTimeline({ quote }: { quote: InternalQuoteWorkspaceViewModel }) {
  return <Card><CardHeader><CardTitle>Activity Timeline</CardTitle></CardHeader><CardContent><div className="grid gap-3 md:grid-cols-4">{quote.workflowEvents.slice(0, 8).map((event) => <div key={event.id} className="border-l-2 border-blue-600 pl-3"><div className="text-sm font-semibold capitalize">{event.event_type.replaceAll("_", " ")}</div><div className="text-xs text-slate-500">{shortDate(event.created_at)}</div></div>)}</div></CardContent></Card>;
}

export default async function QuoteWorkspacePage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const repositories = createRepositories(createServerSupabaseClient());
  const quote = await createQuoteWorkspaceQueryService(repositories).getInternalWorkspace(quoteId);
  if (!quote) notFound();
  return <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950"><div className="mx-auto max-w-[1500px] space-y-6"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Intelligent Quote Workspace</p><h1 className="text-3xl font-bold">{quote.quoteNumber}</h1><p className="text-slate-600">Three-column workspace for resolving exceptions and generating customer-ready quotes.</p></div><Badge className="bg-white text-sm text-slate-700">{quote.status.replaceAll("_", " ")}</Badge></header><section className="grid gap-5 lg:grid-cols-[330px_minmax(0,1fr)_350px]"><aside className="space-y-5"><RequirementsCard quote={quote} /><Card><CardHeader><CardTitle>Corrections</CardTitle></CardHeader><CardContent><CorrectionForm quote={quote} /></CardContent></Card></aside><section className="space-y-5"><QuoteConfigurationTable quote={quote} /><InventoryRecommendation quote={quote} /><ActivityTimeline quote={quote} /></section><aside className="space-y-5"><ReadinessPanel quote={quote} /><SummaryAndSla quote={quote} /><Card><CardHeader><CardTitle>Actions</CardTitle></CardHeader><CardContent><QuoteWorkflowActions quote={quote} /></CardContent></Card></aside></section></div></main>;
}

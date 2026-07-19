import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BadgePercent, Clock3, ShieldCheck } from "lucide-react";

import { WorkspaceLayout } from "@/components/app-shell/workspace-layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerSupabaseClient } from "@/lib/db/server";
import { createRepositories } from "@/lib/repositories";
import { createQuoteWorkspaceQueryService } from "@/lib/services/quote-workspace-query-service";

export const dynamic = "force-dynamic";

const currency = (amount: number, code = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(amount);
const percent = (bps: number) => `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`;
const shortDateTime = (value: string | null) => value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Not set";

export default async function ApprovalPendingPage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const repositories = createRepositories(createServerSupabaseClient());
  const quote = await createQuoteWorkspaceQueryService(repositories).getInternalWorkspace(quoteId);
  if (!quote) notFound();
  if (quote.status === "approved") redirect(`/quotes/${quoteId}/generate`);
  if (quote.status === "rejected") redirect(`/quotes/${quoteId}/configure?rejected=true`);
  const pendingApproval = quote.approvalStatus.approvals.find((approval) => approval.status === "pending");
  const requestedDiscountBps = quote.subtotalAmount ? Math.round((quote.discountAmount / quote.subtotalAmount) * 10_000) : 0;

  return (
    <WorkspaceLayout currentStep="review" status={quote.status} contentClassName="max-w-4xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Approval pending</p><h1 className="text-3xl font-bold">{quote.quoteNumber}</h1><p className="text-slate-600">{quote.customer?.name ?? "Unknown customer"}</p></div>
        <Badge className="bg-white text-sm text-slate-700">{quote.status.replaceAll("_", " ")}</Badge>
      </header>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-blue-600" /> Pending approval summary</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Requested discount</span><strong>{percent(requestedDiscountBps)}</strong></div>
          <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Straight-through threshold</span><strong>{percent(Number((pendingApproval?.metadata as Record<string, unknown> | undefined)?.evaluation && typeof ((pendingApproval?.metadata as Record<string, unknown>).evaluation as Record<string, unknown>).thresholds === "object" ? (((pendingApproval?.metadata as Record<string, unknown>).evaluation as Record<string, unknown>).thresholds as Record<string, unknown>).straightThroughDiscountBps ?? 0 : 0))}</strong></div>
          <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Projected gross margin</span><strong>{percent(quote.margin.grossMarginBps)} ({currency(quote.margin.grossProfitAmount, quote.currencyCode)})</strong></div>
          <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Required approval role</span><strong>{pendingApproval?.required_role.replaceAll("_", " ") ?? "No pending approval"}</strong></div>
          <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Approval requested</span><strong>{shortDateTime(pendingApproval?.requested_at ?? null)}</strong></div>
          <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Workflow status</span><strong>{quote.status.replaceAll("_", " ")}</strong></div>
          <div className="md:col-span-2 rounded-lg bg-slate-50 p-3"><span className="font-semibold text-slate-600">Approval reason: </span>{String(((pendingApproval?.metadata as Record<string, unknown> | undefined)?.evaluation as Record<string, unknown> | undefined)?.reason ?? "Requested discount or margin requires delegated approval.")}</div>
          <div className="flex items-center justify-end gap-4"><BadgePercent className="h-4 w-4 text-blue-600" /><Clock3 className="h-4 w-4 text-orange-600" /></div>
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-3">
        {pendingApproval ? <Link href={`/approvals/${pendingApproval.id}`} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Open pending approval</Link> : null}
        <Link href="/quotes" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white">Back to quote queue</Link>
      </div>
    </WorkspaceLayout>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BadgePercent, CheckCircle2, Clock3, ShieldCheck } from "lucide-react";

import { DashboardButton } from "@/components/app-shell/dashboard-button";
import { WorkspaceLayout } from "@/components/app-shell/workspace-layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerSupabaseClient } from "@/lib/db/server";
import { createRepositories } from "@/lib/repositories";
import { getApprovalPendingPageState } from "@/lib/rules/approval-pending-page-rules";
import { getQuoteStageRouteDecision } from "@/lib/rules/quote-stage-routing";
import { createQuoteWorkspaceQueryService } from "@/lib/services/quote-workspace-query-service";

export const dynamic = "force-dynamic";

const currency = (amount: number, code = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(
    amount,
  );
const percent = (bps: number) =>
  `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`;
const shortDateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Not set";
const metadataObject = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export default async function ApprovalPendingPage({
  params,
}: {
  params: Promise<{ quoteId: string }>;
}) {
  const { quoteId } = await params;
  const repositories = createRepositories(createServerSupabaseClient());
  const quote =
    await createQuoteWorkspaceQueryService(repositories).getInternalWorkspace(
      quoteId,
    );
  if (!quote) notFound();
  if (quote.status === "rejected")
    redirect(`/quotes/${quoteId}/configure?rejected=true`);
  if (!["pending_approval", "approved"].includes(quote.status)) {
    const routeDecision = getQuoteStageRouteDecision(quoteId, quote.status);
    if (routeDecision.kind === "redirect") redirect(routeDecision.href);
    redirect(`/quotes/${quoteId}`);
  }

  const {
    isPending,
    isApproved,
    pendingApproval,
    displayedApproval,
    showContinue,
    showOpenPendingApproval,
  } = getApprovalPendingPageState(
    quote.status,
    quote.approvalStatus.approvals,
    quote.approvalStatus.pendingCount,
  );
  const requestedDiscountBps = quote.subtotalAmount
    ? Math.round((quote.discountAmount / quote.subtotalAmount) * 10_000)
    : 0;
  const evaluation = metadataObject(
    metadataObject(displayedApproval?.metadata).evaluation,
  );
  const thresholds = metadataObject(evaluation.thresholds);
  const straightThroughThreshold = Number(
    thresholds.straightThroughDiscountBps ?? 0,
  );

  return (
    <WorkspaceLayout
      currentStep="review"
      status={quote.status}
      contentClassName="max-w-4xl space-y-6"
      dashboardAction={<DashboardButton mode="navigate" />}
    >
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">
            {isApproved ? "Approval complete" : "Approval pending"}
          </p>
          <h1 className="text-3xl font-bold">{quote.quoteNumber}</h1>
          <p className="text-slate-600">
            {quote.customer?.name ?? "Unknown customer"}
          </p>
        </div>
        <Badge className="bg-white text-sm text-slate-700">
          {isApproved ? "Approved" : quote.status.replaceAll("_", " ")}
        </Badge>
      </header>
      {isApproved ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-4 w-4" /> Approval completed successfully
          </div>
          <p className="mt-1">
            The required approval has been completed. Review the approved
            commercial terms, then continue to generate the customer quote.
          </p>
        </div>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600" />{" "}
            {isPending
              ? "Pending approval summary"
              : "Approval completed summary"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <div className="flex justify-between border-b pb-2">
            <span className="text-slate-500">
              {isApproved ? "Approved discount" : "Requested discount"}
            </span>
            <strong>{percent(requestedDiscountBps)}</strong>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-slate-500">Straight-through threshold</span>
            <strong>{percent(straightThroughThreshold)}</strong>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-slate-500">Projected gross margin</span>
            <strong>
              {percent(quote.margin.grossMarginBps)} (
              {currency(quote.margin.grossProfitAmount, quote.currencyCode)})
            </strong>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-slate-500">Required approval role</span>
            <strong>
              {displayedApproval?.required_role.replaceAll("_", " ") ??
                "Approval record unavailable"}
            </strong>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-slate-500">Approval requested</span>
            <strong>
              {shortDateTime(displayedApproval?.requested_at ?? null)}
            </strong>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-slate-500">Workflow status</span>
            <strong>
              {isApproved ? "approved" : quote.status.replaceAll("_", " ")}
            </strong>
          </div>
          {displayedApproval?.decided_at ? (
            <div className="flex justify-between border-b pb-2">
              <span className="text-slate-500">Approved</span>
              <strong>{shortDateTime(displayedApproval.decided_at)}</strong>
            </div>
          ) : null}
          <div className="md:col-span-2 rounded-lg bg-slate-50 p-3">
            <span className="font-semibold text-slate-600">
              Approval reason:{" "}
            </span>
            {String(
              evaluation.reason ??
                "Requested discount or margin requires delegated approval.",
            )}
          </div>
          {displayedApproval?.comments ? (
            <div className="md:col-span-2 rounded-lg bg-slate-50 p-3">
              <span className="font-semibold text-slate-600">
                Decision comments:{" "}
              </span>
              {displayedApproval.comments}
            </div>
          ) : null}
          <div className="flex items-center justify-end gap-4">
            <BadgePercent className="h-4 w-4 text-blue-600" />
            <Clock3 className="h-4 w-4 text-orange-600" />
          </div>
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-3">
        {showOpenPendingApproval && pendingApproval ? (
          <Link
            href={`/approvals/${pendingApproval.id}`}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Open pending approval
          </Link>
        ) : null}
        {showContinue ? (
          <Link
            href={`/quotes/${quoteId}/generate`}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Continue
          </Link>
        ) : null}
        {isApproved && displayedApproval ? (
          <Link
            href={`/approvals/${displayedApproval.id}`}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
          >
            View approval decision
          </Link>
        ) : null}
        <Link
          href="/quotes"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
        >
          Dashboard
        </Link>
      </div>
    </WorkspaceLayout>
  );
}

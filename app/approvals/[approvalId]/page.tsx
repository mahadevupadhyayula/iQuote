import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgePercent, CheckCircle2, Clock3 } from "lucide-react";

import { ApprovalDecisionForm } from "@/components/approvals/approval-decision-form";
import { WorkspaceGrid } from "@/components/app-shell/workspace-grid";
import { WorkspaceLayout } from "@/components/app-shell/workspace-layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerSupabaseClient } from "@/lib/db/server";
import { createRepositories } from "@/lib/repositories";

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

export default async function ApprovalPage({
  params,
}: {
  params: Promise<{ approvalId: string }>;
}) {
  const { approvalId } = await params;
  const repositories = createRepositories(createServerSupabaseClient());
  const approval = await repositories.approvals.findById(approvalId);
  if (!approval) notFound();
  const quote = await repositories.quotes.findById(approval.quote_id);
  if (!quote) notFound();

  const currentDiscountBps =
    quote.subtotal_amount > 0
      ? Math.round((quote.discount_amount / quote.subtotal_amount) * 10_000)
      : 0;

  return (
    <WorkspaceLayout
      currentStep="review"
      status={quote.status}
      contentClassName="max-w-4xl space-y-6"
    >
      <Link
        href={`/quotes/${quote.id}`}
        className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600"
      >
        <ArrowLeft className="h-4 w-4" /> Back to quote
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">
            Approval Decision
          </p>
          <h1 className="text-3xl font-bold">{quote.quote_number}</h1>
          <p className="text-slate-600">
            Review the pending exception and resume the quote workflow with a
            decision.
          </p>
        </div>
        <Badge className="bg-white text-sm text-slate-700">
          {approval.status}
        </Badge>
      </header>
      <WorkspaceGrid
        main={
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock3 className="h-5 w-5 text-orange-600" /> Approval request
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Required role</span>
                <strong>{approval.required_role.replaceAll("_", " ")}</strong>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Requested</span>
                <strong>{shortDateTime(approval.requested_at)}</strong>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Current status</span>
                <strong>{quote.status.replaceAll("_", " ")}</strong>
              </div>
              {approval.comments ? (
                <p className="rounded-lg bg-slate-100 p-3 text-slate-700">
                  {approval.comments}
                </p>
              ) : null}
            </CardContent>
          </Card>
        }
        right={
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BadgePercent className="h-5 w-5 text-blue-600" /> Commercial
                summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>
                  {currency(quote.subtotal_amount, quote.currency_code)}
                </span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>Discount</span>
                <span>
                  -{currency(quote.discount_amount, quote.currency_code)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Discount rate</span>
                <span>{percent(currentDiscountBps)}</span>
              </div>
              <div className="flex justify-between border-t pt-3 text-lg font-bold">
                <span>Total</span>
                <span>{currency(quote.total_amount, quote.currency_code)}</span>
              </div>
            </CardContent>
          </Card>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Decision
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ApprovalDecisionForm
            approval={approval}
            quoteId={quote.id}
            currentDiscountBps={currentDiscountBps}
          />
        </CardContent>
      </Card>
    </WorkspaceLayout>
  );
}

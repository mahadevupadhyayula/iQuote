import type React from "react";
import Link from "next/link";
import { AlertTriangle, Clock3, FileText, Settings2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  InternalQuoteLineViewModel,
  InternalQuoteWorkspaceViewModel,
} from "@/lib/services/quote-workspace-query-service";
import {
  LineResolutionControls,
  QuoteWorkflowActions,
} from "@/components/quotes/quote-workspace-actions";
import { ReviseQuoteForm } from "@/components/quotes/revise-quote-form";
import { WorkspaceLayout } from "@/components/app-shell/workspace-layout";

const currency = (amount: number, code = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(
    amount,
  );
const percent = (bps: number) =>
  `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`;
const shortDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(value))
    : "Not set";
const shortDateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(value))
    : "Not set";
const relativeMinutes = (minutes: number | null) =>
  minutes == null
    ? "No SLA"
    : minutes < 0
      ? `${Math.abs(minutes)}m breached`
      : minutes > 60
        ? `${Math.floor(minutes / 60)}h ${minutes % 60}m left`
        : `${minutes}m left`;
const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const asArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          item && typeof item === "object",
      )
    : [];
const text = (value: unknown) => (typeof value === "string" ? value : null);
const number = (value: unknown) => (typeof value === "number" ? value : null);
const fulfillmentLabel = (item: Record<string, unknown>) =>
  `${text(item.warehouse) ?? text(item.warehouse_code) ?? text(item.warehouseId) ?? text(item.warehouse_id) ?? "Warehouse"} — ${number(item.quantity) ?? number(item.available_quantity) ?? 0} units`;
const fulfillment = (line: InternalQuoteLineViewModel) =>
  asArray(line.selectedFulfillment).length > 0
    ? asArray(line.selectedFulfillment)
    : asArray(asObject(line.inventoryRecommendation).fulfillment);
const productMatchLabel = (method: string, confirmed: boolean) => {
  if (method === "sku" || method === "exact_sku") return "Exact SKU";
  if (method === "product_name") return "Product name match";
  if (method === "alias" || method === "exact_alias") return "Alias match";
  if (method === "rep_selected" || method === "manual") return "Rep selected";
  if (method === "ai_suggestion" && confirmed) return "AI recommendation confirmed";
  return method.replaceAll("_", " ");
};
const lineTitle = (line: InternalQuoteLineViewModel) => line.productName ?? line.sku ?? "Unmatched product";
const priceTypeLabel = (value: string | null) =>
  value === "customer_specific"
    ? "Customer-specific"
    : value === "customer_tier"
      ? "Customer tier"
      : value === "list"
        ? "List"
        : (value ?? "Not resolved");
const unresolvedInventoryLines = (quote: InternalQuoteWorkspaceViewModel) =>
  quote.lines.filter(
    (line) => !line.inventoryApplied || !line.inventoryConfirmedAt,
  );
const unresolvedProductLines = (quote: InternalQuoteWorkspaceViewModel) =>
  quote.lines.filter((line) => !line.productMatchConfirmed);

function PrimaryCard({
  title,
  icon,
  children,
  className = "",
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card data-primary-card="true" className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function RequirementsCard({
  quote,
}: {
  quote: InternalQuoteWorkspaceViewModel;
}) {
  const address = quote.customer?.shipping_address as
    | Record<string, unknown>
    | undefined;
  const rows = [
    ["Customer", quote.customer?.name ?? "Unknown"],
    ["Opportunity", quote.opportunityId ?? "Not provided"],
    [
      "Requested products",
      quote.lines.map((line) => lineTitle(line)).join(", ") || "No lines",
    ],
    [
      "Quantity",
      String(quote.lines.reduce((sum, line) => sum + line.quantity, 0)),
    ],
    [
      "Delivery location",
      [address?.city, address?.state].filter(Boolean).join(", ") ||
        "Not provided",
    ],
    ["Required date", shortDate(quote.validUntil)],
    [
      "Requested discount",
      quote.requirementsSummary.requestedDiscountBps == null ? "Not requested" : percent(quote.requirementsSummary.requestedDiscountBps),
    ],
    ["Currency", quote.currencyCode],
  ];
  const incomplete = quote.readiness.blockers.some(
    (blocker) =>
      blocker.code === "missing_required_information" ||
      blocker.code === "payment_terms_missing",
  );
  return (
    <PrimaryCard
      title="Requirements"
      icon={<FileText className="h-5 w-5 text-blue-600" />}
      className="order-1 lg:col-span-4"
    >
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="flex justify-between gap-4 border-b pb-2 text-sm"
        >
          <span className="text-slate-500">{label}</span>
          <strong className="text-right text-slate-900">{value}</strong>
        </div>
      ))}
      {incomplete ? (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mr-2 inline h-4 w-4" />
          Some required information is missing.{" "}
          <Link
            className="font-semibold underline"
            href={`/quotes/${quote.id}/needs-information`}
          >
            Complete information
          </Link>
        </div>
      ) : null}
    </PrimaryCard>
  );
}

function InventoryResolutionSection({
  quote,
}: {
  quote: InternalQuoteWorkspaceViewModel;
}) {
  return (
    <section aria-labelledby="inventory-resolution" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 id="inventory-resolution" className="font-semibold">
          Inventory Resolution
        </h3>
        <Badge className="bg-white text-slate-700">
          Inventory resolved: {quote.configuration.inventoryResolvedCount} of{" "}
          {quote.configuration.inventoryRequiredCount} lines
        </Badge>
      </div>
      {quote.lines.map((line) => {
        const allocations = fulfillment(line);
        const recommendation = asObject(line.inventoryRecommendation);
        return (
          <div key={line.id} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{lineTitle(line)}</div>
                <div className="text-xs text-slate-500">SKU: {line.sku}</div>
                <div className="text-sm text-slate-600">
                  Requested quantity: {line.quantity}
                </div>
                {line.customerRequestedDescription ? <div className="text-sm text-slate-600">Requested as: {line.customerRequestedDescription}</div> : null}
                {line.customerSpecifications ? <div className="text-sm text-slate-600">Customer specification: {line.customerSpecifications}</div> : null}
                <div className="mt-2 text-xs text-slate-600">
                  Matched-product state:{" "}
                  <strong>
                    {line.productMatchConfirmed
                      ? "Product confirmed"
                      : "Requires confirmation"}
                  </strong>
                </div>
                <div className="text-xs text-slate-600">
                  Match method and confidence: {productMatchLabel(line.productMatchMethod, line.productMatchConfirmed)} · {Math.round(line.productMatchConfidence * 100)}%
                </div>
              </div>
              <Badge className="bg-white text-slate-700">
                {line.resolutionStatus === "unavailable" ? "Not available" : line.resolutionStatus === "selected" ? "Selected" : "Unresolved"}
              </Badge>
            </div>
            <div className="mt-3 text-sm">
              <div className="font-medium">Recommended fulfilment</div>
              {allocations.length > 0 ? (
                <ul className="mt-1 space-y-1">
                  {allocations.map((item, index) => (
                    <li key={index}>{fulfillmentLabel(item)}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-500">
                  No fulfillable allocation available.
                </p>
              )}
              {text(recommendation.reason) ? (
                <p className="mt-2 text-amber-700">
                  {text(recommendation.reason)}
                </p>
              ) : null}
            </div>
            <div className="mt-3 space-y-1">
              <LineResolutionControls quote={quote} lineNumber={line.lineNumber} />
              {line.resolutionStatus === "unavailable" ? <p className="text-xs text-slate-600">Not available. This requested item will not be included in pricing or quote totals.</p> : line.inventoryApplied ? <> <p className="text-xs text-emerald-700">✓ {line.resolutionSource === "catalogue_selection" ? "Catalogue product selected" : "Recommended product selected"}</p><p className="text-xs text-emerald-700">✓ Inventory confirmed</p></> : line.inventoryBlocker ? <p className="text-xs text-red-700">{line.inventoryBlocker}</p> : null}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function PricingResolutionTable({
  quote,
}: {
  quote: InternalQuoteWorkspaceViewModel;
}) {
  const inventoryRemaining = unresolvedInventoryLines(quote);
  const productRemaining = unresolvedProductLines(quote);
  if (!quote.configuration.allInventorySelectionsApplied)
    return (
      <section className="border-t pt-4">
        <h3 className="font-semibold">Pricing Resolution</h3>
        <p className="mt-2 text-sm text-slate-600">
          Pricing will resolve after all recommendations are applied.
        </p>
        <p className="text-sm text-slate-600">
          {quote.configuration.inventoryResolvedCount} of{" "}
          {quote.configuration.inventoryRequiredCount} products configured.
        </p>
        <p className="text-sm text-slate-600">
          Remaining:{" "}
          {inventoryRemaining.map((line) => line.sku).join(", ") || "None"}.
        </p>
      </section>
    );
  if (!quote.configuration.allProductMatchesConfirmed)
    return (
      <section className="border-t pt-4">
        <h3 className="font-semibold">Pricing Resolution</h3>
        <p className="mt-2 text-sm text-slate-600">
          A product match still requires confirmation.
        </p>
        {productRemaining.map((line) => (
          <p key={line.id} className="text-sm text-slate-600">
            Line {line.lineNumber} · {line.sku}.
          </p>
        ))}
      </section>
    );
  if (quote.configuration.pricingStatus === "blocked")
    return (
      <section className="space-y-2 border-t pt-4">
        <h3 className="font-semibold">Pricing Resolution</h3>
        {quote.configuration.pricingBlockers.map((blocker, index) => {
          const line = quote.lines.find(
            (item) => item.lineNumber === blocker.lineNumber,
          );
          return (
            <p
              key={index}
              className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
            >
              Line {blocker.lineNumber ?? "?"} · {line?.sku ?? "Unknown SKU"} ·{" "}
              {blocker.code}: {blocker.message}
            </p>
          );
        })}
      </section>
    );
  if (!quote.configuration.pricingResolved)
    return (
      <section className="border-t pt-4">
        <h3 className="font-semibold">Pricing Resolution</h3>
        <p className="mt-2 text-sm text-slate-600">
          Pricing will resolve synchronously after configuration is complete.
        </p>
      </section>
    );
  return (
    <section className="space-y-3 border-t pt-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Pricing Resolution</h3>
        <Badge className="bg-emerald-50 text-emerald-700">
          Pricing resolved
        </Badge>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Selection source</TableHead>
              <TableHead>Pricing basis</TableHead>
              <TableHead className="text-right">Unit price</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Gross amount</TableHead>
              <TableHead className="text-right">Discount</TableHead>
              <TableHead className="text-right">Net line total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quote.lines.filter((line) => line.quotable).map((line) => (
              <TableRow key={line.id}>
                <TableCell>
                  <div>{lineTitle(line)}</div>
                  <div className="text-xs text-slate-500">
                    {line.sku} ·{" "}
                    {fulfillment(line).map(fulfillmentLabel).join(", ")}
                  </div>
                </TableCell>
                <TableCell>{line.resolutionSource === "catalogue_selection" ? "Catalogue selection" : "Recommended"}</TableCell>
                <TableCell>
                  <div>{priceTypeLabel(line.priceType)}</div>
                  <div className="text-xs text-slate-500">
                    {line.priceSource ?? "Unknown source"} ·{" "}
                    {line.priceSourceVersion ?? "Unknown version"}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {currency(line.unitPrice, quote.currencyCode)}
                </TableCell>
                <TableCell className="text-right">{line.quantity}</TableCell>
                <TableCell className="text-right">
                  {currency(line.grossAmount, quote.currencyCode)}
                </TableCell>
                <TableCell className="text-right">
                  {percent(line.discountBps)} ·{" "}
                  {currency(line.discountAmount, quote.currencyCode)}
                </TableCell>
                <TableCell className="text-right">
                  {currency(line.netAmount, quote.currencyCode)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {quote.notIncludedLines.length > 0 ? <div className="rounded-lg bg-slate-50 p-3 text-sm"><strong>Items not quoted: {quote.notIncludedLines.length}</strong>{quote.notIncludedLines.map((line) => <p key={line.lineNumber}>{line.sku} — Not available</p>)}</div> : null}
      {quote.configuration.unresolvedLineCount > 0 && quote.configuration.quotableLineCount > 0 ? <p className="text-sm text-amber-700">Partial pricing available. Resolve the remaining requested items before continuing.</p> : null}
    </section>
  );
}

function QuoteConfigurationCard({
  quote,
}: {
  quote: InternalQuoteWorkspaceViewModel;
}) {
  return (
    <PrimaryCard
      title="Quote Configuration"
      icon={<Settings2 className="h-5 w-5 text-blue-600" />}
      className="order-2 lg:col-span-8"
    >
      <InventoryResolutionSection quote={quote} />
      <PricingResolutionTable quote={quote} />
    </PrimaryCard>
  );
}

function QuoteSummaryCard({
  quote,
}: {
  quote: InternalQuoteWorkspaceViewModel;
}) {
  const progress = !quote.configuration.allInventorySelectionsApplied
    ? `Pricing will resolve after inventory is applied. Remaining: ${
        unresolvedInventoryLines(quote)
          .map((line) => line.sku)
          .join(", ") || "None"
      }.`
    : !quote.configuration.allProductMatchesConfirmed
      ? `Pricing is waiting for product confirmation on ${unresolvedProductLines(
          quote,
        )
          .map((line) => `Line ${line.lineNumber} · ${line.sku}`)
          .join(", ")}.`
      : quote.configuration.pricingStatus === "blocked"
        ? "Pricing lookup is blocked; review line-level blockers in Pricing Resolution."
        : "Pricing has not resolved yet.";
  return (
    <PrimaryCard
      title="Quote Summary"
      className="order-3 lg:order-4 lg:col-span-8"
    >
      {!quote.configuration.pricingResolved ? (
        <p className="text-sm text-slate-600">{progress}</p>
      ) : (
        <>
          {quote.notIncludedLines.length > 0 ? <section className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900"><strong>Partial quote</strong><p>{quote.notIncludedLines.length} of {quote.configuration.requestedLineCount} requested products is not available and is excluded from totals.</p></section> : null}
          <section className="space-y-2">
            <h3 className="font-semibold">Customer Quote</h3>
            <div className="flex justify-between text-sm">
              <span>Gross quoted amount</span>
              <span>
                {currency(
                  quote.commercialSummary.grossAmount,
                  quote.currencyCode,
                )}
              </span>
            </div>
            <div className="flex justify-between text-sm text-red-600">
              <span>Applied discount</span>
              <span>
                -
                {currency(
                  quote.commercialSummary.discountAmount,
                  quote.currencyCode,
                )}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Net quoted amount</span>
              <span>
                {currency(
                  quote.commercialSummary.netAmount,
                  quote.currencyCode,
                )}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Tax</span>
              <span>
                {currency(
                  quote.commercialSummary.taxAmount,
                  quote.currencyCode,
                )}
              </span>
            </div>
            <div className="flex justify-between border-t pt-3 text-lg font-bold">
              <span>Total payable</span>
              <span>
                {currency(
                  quote.commercialSummary.totalPayable,
                  quote.currencyCode,
                )}
              </span>
            </div>
          </section>
          <section className="space-y-2 border-t pt-3">
            <h3 className="font-semibold">Internal Economics</h3>
            <div className="flex justify-between text-sm">
              <span>Product cost</span>
              <span>
                {currency(
                  quote.commercialSummary.productCost,
                  quote.currencyCode,
                )}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Gross profit</span>
              <span>
                {currency(
                  quote.commercialSummary.grossProfit,
                  quote.currencyCode,
                )}
              </span>
            </div>
            <div className="flex justify-between text-sm text-emerald-700">
              <span>Gross margin</span>
              <span>{percent(quote.commercialSummary.grossMarginBps)}</span>
            </div>
          </section>
          {quote.notIncludedLines.length > 0 ? <section className="space-y-1 border-t pt-3 text-sm"><h3 className="font-semibold">Not included in quote</h3>{quote.notIncludedLines.map((line) => <div key={line.lineNumber}>{line.sku} — {line.description} · Qty {line.quantity}{line.reason ? ` · ${line.reason}` : ""}</div>)}</section> : null}
        </>
      )}
    </PrimaryCard>
  );
}

function SlaCard({ quote }: { quote: InternalQuoteWorkspaceViewModel }) {
  return (
    <PrimaryCard
      title="SLA"
      icon={<Clock3 className="h-5 w-5 text-orange-600" />}
      className="order-4 lg:order-3 lg:col-span-4"
    >
      <p
        className={`text-2xl font-bold ${quote.sla.breached ? "text-red-600" : "text-orange-600"}`}
      >
        {relativeMinutes(quote.sla.minutesRemaining)}
      </p>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">Started time</span>
          <span>{shortDateTime(quote.sla.startedAt)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Due time</span>
          <span>{shortDateTime(quote.sla.dueAt)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">SLA policy duration</span>
          <span>{quote.sla.policyMinutes ?? "Not set"} minutes</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Breached state</span>
          <span>{quote.sla.breached ? "Breached" : "Within SLA"}</span>
        </div>
      </div>
    </PrimaryCard>
  );
}

export function QuoteConfigurationWorkspace({
  quote,
}: {
  quote: InternalQuoteWorkspaceViewModel;
}) {
  return (
    <WorkspaceLayout status={quote.status} contentClassName="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">
            Intelligent Quote Workspace
          </p>
          <h1 className="text-3xl font-bold">{quote.quoteNumber}</h1>
          <p className="text-slate-600">
            Configure requirements, inventory, pricing, quote totals, and SLA.
          </p>
        </div>
        <Badge className="bg-white text-sm text-slate-700">
          {quote.status.replaceAll("_", " ")}
        </Badge>
      </header>
      {quote.status === "rejected" ? (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle>Approval rejected</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-red-900">
            <p>
              {quote.approvalStatus.approvals.find(
                (approval) => approval.status === "rejected",
              )?.comments ?? "The approver rejected this quote."}
            </p>
            <ReviseQuoteForm quoteId={quote.id} />
          </CardContent>
        </Card>
      ) : null}
      <div
        data-configuration-grid="true"
        className="grid grid-cols-1 gap-6 lg:grid-cols-12"
      >
        <RequirementsCard quote={quote} />
        <QuoteConfigurationCard quote={quote} />
        <QuoteSummaryCard quote={quote} />
        <SlaCard quote={quote} />
      </div>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <QuoteWorkflowActions quote={quote} />
      </div>
    </WorkspaceLayout>
  );
}

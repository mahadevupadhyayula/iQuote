import { notFound, redirect } from "next/navigation";
import { Clock3, XCircle } from "lucide-react";

import { WorkspaceLayout } from "@/components/app-shell/workspace-layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerSupabaseClient } from "@/lib/db/server";
import { createRepositories } from "@/lib/repositories";
import { getQuoteStageRouteDecision } from "@/lib/rules/quote-stage-routing";

export const dynamic = "force-dynamic";

export default async function QuoteStatusRouterPage({
  params,
}: {
  params: Promise<{ quoteId: string }>;
}) {
  const { quoteId } = await params;
  const repositories = createRepositories(createServerSupabaseClient());
  const quote = await repositories.quotes.findById(quoteId);
  if (!quote) notFound();

  const decision = getQuoteStageRouteDecision(quote.id, quote.status);
  if (decision.kind === "redirect") redirect(decision.href);

  const isExtracting = decision.state === "extracting";
  const Icon = isExtracting ? Clock3 : XCircle;

  return (
    <WorkspaceLayout status={quote.status} contentClassName="max-w-3xl space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">
          Intelligent Quote Workspace
        </p>
        <h1 className="text-3xl font-bold">{quote.quote_number}</h1>
        <Badge className="bg-white text-sm text-slate-700">
          {quote.status.replaceAll("_", " ")}
        </Badge>
      </header>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-blue-600" />
            {isExtracting ? "Extracting quote details" : "Quote cancelled"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">
          {isExtracting
            ? "We are processing the customer request and preparing the quote workspace. Refresh this page shortly to continue."
            : "This quote is read-only because the workflow has been cancelled."}
        </CardContent>
      </Card>
    </WorkspaceLayout>
  );
}

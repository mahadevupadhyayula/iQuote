import { notFound } from "next/navigation";
import { FileQuestion, MessageSquareText } from "lucide-react";

import { WorkspaceLayout } from "@/components/app-shell/workspace-layout";
import { NeedsInformationForm } from "@/components/quotes/needs-information-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerSupabaseClient } from "@/lib/db/server";
import { createRepositories } from "@/lib/repositories";
import { createQuoteWorkspaceQueryService } from "@/lib/services/quote-workspace-query-service";

export const dynamic = "force-dynamic";

export default async function NeedsInformationPage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const repositories = createRepositories(createServerSupabaseClient());
  const quote = await createQuoteWorkspaceQueryService(repositories).getInternalWorkspace(quoteId);
  if (!quote) notFound();

  return (
    <WorkspaceLayout currentStep="intake" status={quote.status} contentClassName="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Needs information</p>
          <h1 className="text-3xl font-bold">{quote.quoteNumber}</h1>
          <p className="text-slate-600">Complete only the missing or ambiguous customer-provided facts before configuration.</p>
        </div>
        <Badge className="bg-white text-sm text-slate-700">{quote.status.replaceAll("_", " ")}</Badge>
      </header>
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.4fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquareText className="h-5 w-5 text-blue-600" /> Original customer request</CardTitle></CardHeader>
            <CardContent><p className="whitespace-pre-wrap rounded-lg bg-slate-100 p-4 text-sm text-slate-700">{quote.reviewMetadata.originalRequestText ?? "Original request text is not available for this quote."}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileQuestion className="h-5 w-5 text-amber-600" /> Why input is required</CardTitle></CardHeader>
            <CardContent className="text-sm text-slate-600">Extraction found missing, ambiguous, or low-confidence requirements. This page captures rep-confirmed facts only; catalog configuration, pricing, inventory, margin, approvals, and quote generation happen later.</CardContent>
          </Card>
        </div>
        <NeedsInformationForm quote={quote} />
      </div>
    </WorkspaceLayout>
  );
}

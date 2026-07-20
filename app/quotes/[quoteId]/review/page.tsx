import { notFound } from "next/navigation";
import { MessageSquareText } from "lucide-react";

import { WorkspaceLayout } from "@/components/app-shell/workspace-layout";
import { ReviewInformationForm } from "@/components/quotes/review-information-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerSupabaseClient } from "@/lib/db/server";
import { createRepositories } from "@/lib/repositories";
import { createQuoteWorkspaceQueryService } from "@/lib/services/quote-workspace-query-service";

export const dynamic = "force-dynamic";

export default async function ReviewInformationPage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const repositories = createRepositories(createServerSupabaseClient());
  const quote = await createQuoteWorkspaceQueryService(repositories).getInternalWorkspace(quoteId);
  if (!quote) notFound();
  return (
    <WorkspaceLayout currentStep="review" status={quote.status} contentClassName="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Review Information</p>
          <h1 className="text-3xl font-bold">{quote.quoteNumber}</h1>
          <p className="text-slate-600">Review every canonical request field before catalog configuration, pricing, inventory, approvals, generation, PDF, or sending.</p>
        </div>
        <Badge className="bg-white text-sm text-slate-700">{quote.status.replaceAll("_", " ")}</Badge>
      </header>
      <div className="grid gap-4 lg:grid-cols-[0.85fr_1.5fr]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquareText className="h-5 w-5 text-blue-600" /> Original customer request</CardTitle></CardHeader>
          <CardContent><p className="whitespace-pre-wrap rounded-lg bg-slate-100 p-4 text-sm text-slate-700">{quote.reviewMetadata.originalRequestText ?? "Original request text is not available for this quote."}</p></CardContent>
        </Card>
        <ReviewInformationForm quote={quote} />
      </div>
    </WorkspaceLayout>
  );
}

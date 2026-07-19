import { notFound } from "next/navigation";
import { FileQuestion, MessageSquareText, PenLine, Save } from "lucide-react";

import { WorkspaceLayout } from "@/components/app-shell/workspace-layout";
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
          <p className="text-slate-600">Collect controlled clarifications before configuration.</p>
        </div>
        <Badge className="bg-white text-sm text-slate-700">{quote.status.replaceAll("_", " ")}</Badge>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquareText className="h-5 w-5 text-blue-600" /> Original customer request</CardTitle></CardHeader>
          <CardContent><p className="rounded-lg bg-slate-100 p-4 text-sm text-slate-700">{quote.reviewMetadata.originalRequestText ?? "Original request text is not available for this quote."}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileQuestion className="h-5 w-5 text-amber-600" /> Missing and ambiguous fields</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            {quote.reviewMetadata.missingFields.length > 0 ? quote.reviewMetadata.missingFields.map((field) => <Badge key={field} className="mr-2 bg-amber-100 text-amber-800">{field.replaceAll("_", " ")}</Badge>) : <p>No missing fields were recorded.</p>}
            <p className="pt-3">Clarification inputs and ambiguity resolution will be added here in a follow-up task.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><PenLine className="h-5 w-5 text-blue-600" /> Manual-entry fallback</CardTitle></CardHeader>
          <CardContent className="text-sm text-slate-600">A controlled manual-entry form will let users complete required quote facts without changing commercial truth.</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Save className="h-5 w-5 text-emerald-600" /> Save and continue</CardTitle></CardHeader>
          <CardContent className="text-sm text-slate-600">Placeholder for the workflow action that will persist clarifications and continue through the workflow service.</CardContent>
        </Card>
      </div>
    </WorkspaceLayout>
  );
}

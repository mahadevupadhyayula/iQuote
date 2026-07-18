import { WorkspaceLayout } from "@/components/app-shell/workspace-layout";
import { QuoteIntakeForm } from "@/components/quotes/quote-intake-form";
import { createServerSupabaseClient } from "@/lib/db/server";
import { createRepositories } from "@/lib/repositories";

export default async function NewQuotePage() {
  const repositories = createRepositories(createServerSupabaseClient());
  const recentQuotes = await repositories.quotes.listRecent(4);
  const recentActivity = recentQuotes.map((quote) => ({
    id: quote.id,
    label: `${quote.quote_number} moved through ${quote.status.replaceAll("_", " ")}`,
    description: `Workflow event source: recent quote activity for ${quote.currency_code} quote.`,
    timestamp: quote.updated_at,
  }));

  return (
    <WorkspaceLayout currentStep="intake" contentClassName="space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-600">
          New quote
        </p>
        <h1 className="text-4xl font-bold tracking-tight">
          Intake a customer request
        </h1>
        <p className="max-w-3xl text-slate-600">
          Create a draft quote, run extraction and catalog matching, then
          continue manually whenever source details or AI services are
          incomplete.
        </p>
      </div>
      <QuoteIntakeForm recentActivity={recentActivity} />
    </WorkspaceLayout>
  );
}

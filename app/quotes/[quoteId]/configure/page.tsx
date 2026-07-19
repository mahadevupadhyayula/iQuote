import { notFound } from "next/navigation";

import { QuoteConfigurationWorkspace } from "@/components/quotes/quote-configuration-workspace";
import { createServerSupabaseClient } from "@/lib/db/server";
import { createRepositories } from "@/lib/repositories";
import { createQuoteWorkspaceQueryService } from "@/lib/services/quote-workspace-query-service";

export const dynamic = "force-dynamic";

export default async function QuoteConfigurePage({
  params,
}: {
  params: Promise<{ quoteId: string }>;
}) {
  const { quoteId } = await params;
  const repositories = createRepositories(createServerSupabaseClient());
  const quote = await createQuoteWorkspaceQueryService(
    repositories,
  ).getInternalWorkspace(quoteId);
  if (!quote) notFound();

  return <QuoteConfigurationWorkspace quote={quote} />;
}

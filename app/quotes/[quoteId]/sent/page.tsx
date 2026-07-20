import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

import { WorkspaceLayout } from "@/components/app-shell/workspace-layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerSupabaseClient } from "@/lib/db/server";
import { createRepositories } from "@/lib/repositories";
import { createQuoteWorkspaceQueryService } from "@/lib/services/quote-workspace-query-service";

export const dynamic = "force-dynamic";
const shortDateTime = (value: string | null) => value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Not recorded";

export default async function SentQuotePage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const repositories = createRepositories(createServerSupabaseClient());
  const quote = await createQuoteWorkspaceQueryService(repositories).getCustomerQuote(quoteId);
  if (!quote) notFound();
  const quoteRecord = await repositories.quotes.findById(quoteId);
  const receipt = (quoteRecord?.metadata.mock_delivery_receipt ?? {}) as Record<string, unknown>;

  return (
    <WorkspaceLayout currentStep="generate-quote" status={quote.status} contentClassName="max-w-3xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Quote sent</p><h1 className="text-3xl font-bold">{quote.quoteNumber}</h1></div><Badge className="bg-white text-sm text-slate-700">{quote.status.replaceAll("_", " ")}</Badge></header>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /> Sent confirmation</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-slate-700"><p>The customer quote has been sent.</p><div className="flex justify-between border-b pb-2"><span>Recipient</span><strong>{String(receipt.recipient_email ?? quote.customer?.billing_email ?? quote.customer?.name ?? "Recipient not recorded")}</strong></div><div className="flex justify-between border-b pb-2"><span>Sent</span><strong>{shortDateTime(quote.sentAt ?? (typeof receipt.sentAt === "string" ? receipt.sentAt : null))}</strong></div><div className="flex justify-between border-b pb-2"><span>Mock delivery status</span><strong>{String(receipt.status ?? "sent")}</strong></div><Link href={`/api/quotes/${quote.id}/pdf`} className="inline-flex font-semibold text-blue-600 hover:text-blue-800">Access PDF</Link></CardContent></Card>
      <Link href="/quotes" className="font-semibold text-blue-600 hover:text-blue-800">Back to quote queue</Link>
    </WorkspaceLayout>
  );
}

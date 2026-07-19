import Link from "next/link";
import { Clock3, FilePlus2, FolderOpen, ListChecks } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createServerSupabaseClient } from "@/lib/db/server";
import { createRepositories } from "@/lib/repositories";
import { getQuoteQueueActionLabel } from "@/lib/rules/quote-stage-routing";
import type { QuoteRecord } from "@/lib/schemas/shared-records";

export const dynamic = "force-dynamic";

const currency = (amount: number, code = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(amount);
const shortDateTime = (value: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));

const slaState = (quote: QuoteRecord) => {
  const metadataDueAt = typeof quote.metadata.sla_due_at === "string" ? quote.metadata.sla_due_at : null;
  const dueAt = metadataDueAt ?? (quote.valid_until ? `${quote.valid_until}T23:59:59.999Z` : null);
  if (!dueAt) return { label: "No SLA", className: "bg-slate-100 text-slate-700" };

  const minutesRemaining = Math.floor((new Date(dueAt).getTime() - Date.now()) / 60_000);
  if (minutesRemaining < 0) return { label: "Breached", className: "bg-red-100 text-red-700" };
  if (minutesRemaining <= 60) return { label: "Due soon", className: "bg-amber-100 text-amber-800" };
  return { label: "On track", className: "bg-emerald-100 text-emerald-700" };
};

export default async function QuotesPage() {
  const repositories = createRepositories(createServerSupabaseClient());
  const quotes = await repositories.quotes.listRecent(25);
  const customers = await Promise.all(quotes.map((quote) => repositories.customers.findById(quote.customer_id)));
  const customerById = new Map(customers.filter((customer): customer is NonNullable<typeof customer> => Boolean(customer)).map((customer) => [customer.id, customer.name]));

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Quote workspace</p>
            <h1 className="text-4xl font-bold tracking-tight">Recent quotes</h1>
            <p className="max-w-3xl text-slate-600">Open an active quote workspace or create a new quote from a customer request.</p>
          </div>
          <Link href="/quotes/new" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
            <FilePlus2 className="h-4 w-4" /> Create quote
          </Link>
        </header>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-xl"><ListChecks className="h-5 w-5 text-blue-600" /> Quote queue</CardTitle>
            <Badge className="bg-white text-slate-700">{quotes.length} recent</Badge>
          </CardHeader>
          <CardContent>
            {quotes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center">
                <FolderOpen className="mx-auto h-10 w-10 text-slate-400" />
                <h2 className="mt-4 text-xl font-semibold">No quotes yet</h2>
                <p className="mt-2 text-slate-600">Create the first quote to start the workspace flow.</p>
                <Link href="/quotes/new" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"><FilePlus2 className="h-4 w-4" /> Create quote</Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Quote #</TableHead><TableHead>Customer</TableHead><TableHead>Status</TableHead><TableHead>Total</TableHead><TableHead>SLA</TableHead><TableHead>Updated</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {quotes.map((quote) => {
                    const sla = slaState(quote);
                    return (
                      <TableRow key={quote.id}>
                        <TableCell className="font-semibold">{quote.quote_number}</TableCell>
                        <TableCell>{customerById.get(quote.customer_id) ?? "Unknown customer"}</TableCell>
                        <TableCell><Badge className="bg-white text-slate-700 capitalize">{quote.status.replaceAll("_", " ")}</Badge></TableCell>
                        <TableCell>{currency(quote.total_amount, quote.currency_code)}</TableCell>
                        <TableCell><Badge className={sla.className}><Clock3 className="mr-1 h-3 w-3" /> {sla.label}</Badge></TableCell>
                        <TableCell className="text-slate-600">{shortDateTime(quote.updated_at)}</TableCell>
                        <TableCell className="text-right"><Link href={`/quotes/${quote.id}`} className="font-semibold text-blue-600 hover:text-blue-800">{getQuoteQueueActionLabel(quote.status)}</Link></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

import { QuoteIntakeForm } from "@/components/quotes/quote-intake-form";

export default function NewQuotePage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-600">New quote</p>
          <h1 className="text-4xl font-bold tracking-tight">Intake a customer request</h1>
          <p className="max-w-3xl text-slate-600">Create a draft quote, run extraction and catalog matching, then continue manually whenever source details or AI services are incomplete.</p>
        </div>
        <QuoteIntakeForm />
      </div>
    </main>
  );
}

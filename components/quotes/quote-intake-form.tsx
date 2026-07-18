"use client";

import type { ReactNode } from "react";
import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileUp,
  Loader2,
  Wand2,
} from "lucide-react";

import {
  submitQuoteIntake,
  type IntakeActionState,
} from "@/app/quotes/new/actions";
import { WorkspaceGrid } from "@/components/app-shell/workspace-grid";
import {
  quoteIntakeSchema,
  type QuoteIntakeInput,
} from "@/lib/schemas/quote-intake";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type FormErrors = Partial<Record<keyof QuoteIntakeInput, { message?: string }>>;

const resolver = async (values: QuoteIntakeInput) => {
  const result = quoteIntakeSchema.safeParse(values);
  if (result.success) return { values: result.data, errors: {} };
  return {
    values: {},
    errors: result.error.issues.reduce<FormErrors>((errors, issue) => {
      const name = issue.path[0] as keyof QuoteIntakeInput;
      errors[name] = { message: issue.message };
      return errors;
    }, {}),
  };
};

const intakeChecklist = [
  "Customer and billing contact captured",
  "Request text pasted for extraction",
  "Attachment placeholder noted when a file exists",
  "Extraction preview checked for missing fields",
  "Manual fallback ready if AI or catalog matching fails",
];

export function QuoteIntakeForm() {
  const [result, setResult] = useState<IntakeActionState | null>(null);
  const [isPending, startTransition] = useTransition();
  const form = useForm<QuoteIntakeInput>({
    resolver,
    defaultValues: {
      customerName: "",
      customerEmail: "",
      companyDomain: "",
      opportunityName: "",
      currencyCode: "USD",
      validUntil: "",
      requestText: "",
      attachmentName: "",
    },
  });
  const requestText = form.watch("requestText");
  const readiness = useMemo(
    () => Math.min(100, Math.round(((requestText?.length ?? 0) / 240) * 100)),
    [requestText],
  );

  const onSubmit = (values: QuoteIntakeInput) => {
    setResult(null);
    startTransition(async () => setResult(await submitQuoteIntake(values)));
  };

  return (
    <WorkspaceGrid
      main={
        <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
          <Card>
            <CardHeader>
              <CardTitle>Customer request entry</CardTitle>
              <CardDescription>
                Paste the email, call notes, or RFQ details. We create a draft
                first, then try extraction and quote build.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field
                label="Customer name"
                error={form.formState.errors.customerName?.message}
              >
                <Input
                  {...form.register("customerName")}
                  placeholder="Acme Operations"
                />
              </Field>
              <Field
                label="Customer email"
                error={form.formState.errors.customerEmail?.message}
              >
                <Input
                  {...form.register("customerEmail")}
                  placeholder="buyer@acme.com"
                  type="email"
                />
              </Field>
              <Field label="Company domain">
                <Input
                  {...form.register("companyDomain")}
                  placeholder="acme.com"
                />
              </Field>
              <Field label="Opportunity">
                <Input
                  {...form.register("opportunityName")}
                  placeholder="Q3 refresh"
                />
              </Field>
              <Field
                label="Currency"
                error={form.formState.errors.currencyCode?.message}
              >
                <Input {...form.register("currencyCode")} maxLength={3} />
              </Field>
              <Field label="Valid until">
                <Input {...form.register("validUntil")} type="date" />
              </Field>
              <div className="md:col-span-2">
                <Field
                  label="Request text"
                  error={form.formState.errors.requestText?.message}
                >
                  <Textarea
                    {...form.register("requestText")}
                    className="min-h-48"
                    placeholder="Paste customer request, quantities, SKUs, dates, delivery constraints, and target price here..."
                  />
                </Field>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start gap-3 space-y-0">
              <FileUp className="mt-1 h-5 w-5 text-cyan-500" />
              <div>
                <CardTitle>Optional attachment placeholder</CardTitle>
                <CardDescription>
                  File upload is staged for a later document pipeline; capture
                  the expected file name now.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Input
                {...form.register("attachmentName")}
                placeholder="customer-rfq.pdf"
              />
            </CardContent>
          </Card>

          {result && <ResultPanel result={result} />}

          <Button
            className="w-full md:w-auto"
            disabled={isPending}
            type="submit"
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="mr-2 h-4 w-4" />
            )}
            Create draft and run extraction
          </Button>
        </form>
      }
      right={
        <>
          <Card>
            <CardHeader>
              <CardTitle>Extraction preview</CardTitle>
              <CardDescription>
                Live readiness and post-submit extracted lines.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="mb-2 flex justify-between text-sm">
                  <span>Request detail</span>
                  <span>{readiness}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-cyan-500"
                    style={{ width: `${readiness}%` }}
                  />
                </div>
              </div>
              {result?.ok && result.previewLines.length > 0 ? (
                result.previewLines.map((line, index) => (
                  <div
                    className="rounded-lg border p-3 text-sm"
                    key={`${line.sku}-${index}`}
                  >
                    <p className="font-medium">{line.sku ?? "No SKU"}</p>
                    <p className="text-slate-600">
                      {line.description ?? "No description"}
                    </p>
                    <p className="text-slate-500">
                      Qty: {line.quantity ?? "TBD"}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  Submit to see extracted SKUs, descriptions, and quantities.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Missing-information suggestions</CardTitle>
            </CardHeader>
            <CardContent>
              <SuggestionList result={result} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Checklist</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {intakeChecklist.map((item) => (
                <div className="flex gap-2 text-sm" key={item}>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock3 className="h-5 w-5" />
                SLA card
              </CardTitle>
              <CardDescription>
                Draft intake target: under 15 minutes. Manual fallback target:
                same business day.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Badge>Standard SLA</Badge>
            </CardContent>
          </Card>
        </>
      }
    />
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-2 text-sm font-medium">
      <span>{label}</span>
      {children}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </label>
  );
}

function ResultPanel({ result }: { result: IntakeActionState }) {
  if (!result.ok)
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Manual fallback enabled</AlertTitle>
        <AlertDescription>{result.error}</AlertDescription>
      </Alert>
    );
  return (
    <Alert>
      <CheckCircle2 className="h-4 w-4" />
      <AlertTitle>Draft {result.quoteNumber} created</AlertTitle>
      <AlertDescription>
        Quote status is {result.status}. Extraction is{" "}
        {result.extractionStatus === "completed"
          ? "ready for review"
          : "in manual fallback"}
        .
      </AlertDescription>
    </Alert>
  );
}

function SuggestionList({ result }: { result: IntakeActionState | null }) {
  const suggestions = result
    ? result.suggestions
    : [
        "Paste enough context to identify customer, line items, quantities, delivery timing, and pricing constraints.",
      ];
  return (
    <ul className="space-y-2 text-sm text-slate-600">
      {suggestions.map((suggestion) => (
        <li className="list-disc ml-4" key={suggestion}>
          {suggestion}
        </li>
      ))}
    </ul>
  );
}

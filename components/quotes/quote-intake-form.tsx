"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import type { FieldErrors, Resolver, SubmitHandler } from "react-hook-form";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  ClipboardCheck,
  FileText,
  FileUp,
  Loader2,
  Sparkles,
} from "lucide-react";

import {
  submitQuoteIntake,
  type IntakeActionState,
} from "@/app/quotes/new/actions";
import { WorkspaceGrid } from "@/components/app-shell/workspace-grid";
import {
  quoteIntakeSchema,
  type QuoteIntakeInput,
  type QuoteIntakeSeedId,
} from "@/lib/schemas/quote-intake";
import {
  intakeSeedExamples,
  intakeSeedExampleById,
} from "@/lib/fixtures/intake-seed-examples";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type FormErrors = FieldErrors<QuoteIntakeInput>;

type RecentActivityItem = {
  id: string;
  label: string;
  description: string;
  timestamp: string;
};

type QuoteIntakeFormProps = {
  recentActivity?: RecentActivityItem[];
};

const resolver: Resolver<QuoteIntakeInput> = async (values) => {
  const result = quoteIntakeSchema.safeParse(values);
  if (result.success) return { values: result.data, errors: {} };
  return {
    values: {},
    errors: result.error.issues.reduce<FormErrors>((errors, issue) => {
      const name = issue.path[0] as keyof QuoteIntakeInput;
      errors[name] = { type: "manual", message: issue.message };
      return errors;
    }, {}),
  };
};

const intakeChecklist = [
  "Customer identified",
  "Product or service request captured",
  "Quantity or scope detected",
  "Delivery timing and location checked",
  "Discount or commercial request flagged for review",
  "Clarifications recorded before review",
];

export function QuoteIntakeForm({ recentActivity = [] }: QuoteIntakeFormProps) {
  const router = useRouter();
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
  const slaPreview = useMemo(() => {
    const startedAt = new Date();
    const dueAt = new Date(startedAt.getTime() + 15 * 60 * 1000);
    return { startedAt, dueAt };
  }, []);

  const onSeedExampleChange = (value: string) => {
    const id = value as QuoteIntakeSeedId;
    const seedExample = intakeSeedExampleById[id];
    form.setValue("seededScenarioId", id, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("requestText", seedExample.requestText, {
      shouldDirty: true,
      shouldValidate: true,
    });

    const metadataFields = Object.entries(seedExample.metadata) as [
      keyof QuoteIntakeInput,
      string,
    ][];

    for (const [fieldName, fieldValue] of metadataFields) {
      form.setValue(fieldName, fieldValue, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  };

  useEffect(() => {
    if (!result?.ok) return;
    if (result.status === "needs_information") {
      router.push(`/quotes/${result.quoteId}/needs-information`);
      return;
    }
    if (result.status === "configuring") router.push(`/quotes/${result.quoteId}/configure`);
  }, [result, router]);

  const onSubmit: SubmitHandler<QuoteIntakeInput> = (values) => {
    setResult(null);
    startTransition(async () => setResult(await submitQuoteIntake(values)));
  };

  return (
    <WorkspaceGrid
      main={
        <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
          <Card className="border-blue-100 shadow-sm">
            <CardHeader className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <CardTitle>Customer Request Intake</CardTitle>
              </div>
              <CardDescription>
                Paste the customer request, choose a seeded demo example, or
                note V1 attachment context before extraction.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Field label="Seed example for reliable demos">
                <Select
                  onValueChange={onSeedExampleChange}
                  value={form.watch("seededScenarioId") ?? ""}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an example request" />
                  </SelectTrigger>
                  <SelectContent>
                    {intakeSeedExamples.map((example) => (
                      <SelectItem key={example.id} value={example.id}>
                        {example.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label="Customer request"
                error={form.formState.errors.requestText?.message}
              >
                <Textarea
                  {...form.register("requestText")}
                  className="min-h-[18rem] resize-y border-blue-200 text-base leading-7 shadow-inner focus-visible:ring-blue-500"
                  placeholder="Paste customer request, quantities, SKUs, dates, delivery constraints, requested discounts, and clarification notes here..."
                />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
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
              </div>
            </CardContent>
          </Card>

          <Card className="border-dashed border-slate-300 bg-slate-50/70">
            <CardHeader className="flex flex-row items-start gap-3 space-y-0">
              <FileUp className="mt-1 h-5 w-5 text-blue-600" />
              <div>
                <CardTitle>Attachments (optional)</CardTitle>
                <CardDescription>
                  V1 visual / limited implementation: capture a file name for
                  audit context. Binary upload and document parsing are not
                  active in this intake step.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border border-dashed border-blue-200 bg-white p-6 text-center text-sm text-slate-600">
                <FileUp className="mx-auto mb-2 h-8 w-8 text-blue-500" />
                Drag and drop files here or browse files in a future version.
                <p className="mt-1 text-xs text-slate-500">
                  PDF, DOCX, XLSX, and EML metadata only for V1.
                </p>
              </div>
              <Input
                {...form.register("attachmentName")}
                placeholder="customer-rfq.pdf"
              />
            </CardContent>
          </Card>

          {result && <ResultPanel result={result} />}

          <Button
            className="w-full bg-blue-600 text-base hover:bg-blue-700 md:w-auto"
            disabled={isPending}
            size="lg"
            type="submit"
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Extract and Build Quote
          </Button>
        </form>
      }
      right={
        <>
          <Card>
            <CardHeader>
              <CardTitle>AI Extraction Preview</CardTitle>
              <CardDescription>
                Confidence-style readiness and post-submit extracted lines.
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
                    className="h-2 rounded-full bg-blue-600"
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
              <CardTitle>Suggestions & Missing Information</CardTitle>
            </CardHeader>
            <CardContent>
              <SuggestionList result={result} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-blue-600" /> Intake
                Checklist
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {intakeChecklist.map((item, index) => (
                <div className="flex gap-2 text-sm" key={item}>
                  {index < 4 ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                  )}
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock3 className="h-5 w-5 text-blue-600" /> SLA Information
              </CardTitle>
              <CardDescription>
                Preview starts when this intake is submitted.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span>Start preview</span>
                <span className="font-medium">
                  {formatTime(slaPreview.startedAt)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Due preview</span>
                <span className="font-medium text-blue-700">
                  {formatTime(slaPreview.dueAt)}
                </span>
              </div>
              <Badge className="bg-blue-50 text-blue-700">
                15-minute intake SLA
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity) => (
                  <div
                    className="border-l-2 border-blue-200 pl-3 text-sm"
                    key={activity.id}
                  >
                    <p className="font-medium">{activity.label}</p>
                    <p className="text-slate-600">{activity.description}</p>
                    <p className="text-xs text-slate-500">
                      {formatTime(new Date(activity.timestamp))}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  Recent quotes and workflow events will appear here after
                  intake activity is recorded.
                </p>
              )}
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
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
        <span className="mt-2 block text-xs text-slate-600">
          SLA started {formatDateTime(result.slaStartedAt)} and is due {formatDateTime(result.slaDueAt)}.
        </span>{" "}
        <span className="mt-2 block font-semibold text-blue-700">
          Navigating to the next quote workspace…
        </span>
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

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

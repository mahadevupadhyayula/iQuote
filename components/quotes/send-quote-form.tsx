"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { sendQuote } from "@/app/quotes/[quoteId]/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function SendQuoteForm({ quoteId, defaultRecipient }: { quoteId: string; defaultRecipient?: string | null }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const idempotencyKey = useMemo(() => `send-quote-${quoteId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`, [quoteId]);

  return (
    <form
      action={(formData) => {
        setMessage(null);
        startTransition(async () => {
          try {
            await sendQuote({
              quote_id: quoteId,
              actor_id: null,
              recipient_email: String(formData.get("recipient_email") ?? ""),
              message: String(formData.get("message") ?? "") || undefined,
              idempotency_key: idempotencyKey,
            });
            router.push(`/quotes/${quoteId}/sent`);
            router.refresh();
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Unable to send quote.");
          }
        });
      }}
      className="space-y-4"
    >
      <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">Demo mode: email delivery is simulated by the notification adapter.</p>
      <label className="block text-sm font-semibold text-slate-600">Recipient email<input name="recipient_email" type="email" required defaultValue={defaultRecipient ?? ""} className="mt-2 w-full rounded-lg border px-3 py-2 text-sm" /></label>
      <label className="block text-sm font-semibold text-slate-600">Optional message<Textarea name="message" placeholder="Add a short note for the customer" className="mt-2" /></label>
      <p className="text-xs text-slate-500">PDF reference: /api/quotes/{quoteId}/pdf</p>
      <Button type="submit" disabled={isPending}>{isPending ? "Sending..." : "Send quote"}</Button>
      {message ? <p className="text-sm text-red-600">{message}</p> : null}
    </form>
  );
}

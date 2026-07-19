"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { reviseRejectedQuote } from "@/app/quotes/[quoteId]/actions";
import { Button } from "@/components/ui/button";

export function ReviseQuoteForm({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return <Button type="button" disabled={isPending} onClick={() => startTransition(async () => { await reviseRejectedQuote({ quote_id: quoteId, actor_id: null, idempotency_key: `revise-${quoteId}` }); router.push(`/quotes/${quoteId}/configure?rejected=true`); router.refresh(); })}>{isPending ? "Revising..." : "Revise Quote"}</Button>;
}

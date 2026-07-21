"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type DemoActivityResetResult = {
  quotesDeleted: number;
  quoteItemsDeleted: number;
  approvalsDeleted: number;
  workflowEventsDeleted: number;
};

const successMessage = (counts: DemoActivityResetResult) => {
  if (
    counts.quotesDeleted === 0 &&
    counts.quoteItemsDeleted === 0 &&
    counts.approvalsDeleted === 0 &&
    counts.workflowEventsDeleted === 0
  ) {
    return "Demo is already clean.";
  }

  return `Demo reset complete. ${counts.quotesDeleted} ${counts.quotesDeleted === 1 ? "quote" : "quotes"} and related activity were removed.`;
};

export function ResetDemoButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");

  const resetDemo = async () => {
    setIsResetting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/demo/clear-activity", { method: "POST" });
      const payload = await response.json() as { counts?: DemoActivityResetResult; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to reset demo activity.");
      }

      setMessageTone("success");
      setMessage(successMessage(payload.counts ?? {
        quotesDeleted: 0,
        quoteItemsDeleted: 0,
        approvalsDeleted: 0,
        workflowEventsDeleted: 0,
      }));
      setOpen(false);
      router.refresh();
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Unable to reset demo activity.");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <Dialog open={open} onOpenChange={(nextOpen) => { if (!isResetting) setOpen(nextOpen); }}>
        <DialogTrigger asChild>
          <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800" disabled={isResetting}>
            <RotateCcw className="mr-2 h-4 w-4" />
            {isResetting ? "Resetting..." : "Reset demo"}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset demo activity?</DialogTitle>
            <DialogDescription>
              This will permanently remove all generated quotes, quote items, approval decisions, and workflow history.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Customers, products, prices, inventory, and discount policies will remain available.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isResetting}>Cancel</Button>
            </DialogClose>
            <Button type="button" variant="destructive" onClick={resetDemo} disabled={isResetting}>
              {isResetting ? "Resetting..." : "Reset demo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {message ? (
        <p aria-live="polite" className={messageTone === "success" ? "text-sm text-emerald-700" : "text-sm text-red-700"}>
          {message}
        </p>
      ) : null}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Home } from "lucide-react";

import { Button } from "@/components/ui/button";

type DashboardButtonProps =
  | { mode: "navigate"; disabled?: boolean }
  | { mode: "save"; saveAction: () => Promise<unknown>; disabled?: boolean }
  | { mode: "submit-form"; formId: string; disabled?: boolean };

const errorMessage = "Unable to save the draft. Your page has not been closed.";

export function DashboardButton(props: DashboardButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const disabled = props.disabled || isPending;

  if (props.mode === "submit-form") {
    return (
      <Button
        aria-label="Dashboard"
        className="w-full sm:w-auto"
        disabled={props.disabled}
        form={props.formId}
        name="intent"
        type="submit"
        value="dashboard"
        variant="outline"
      >
        <Home className="mr-2 h-4 w-4" /> Dashboard
      </Button>
    );
  }

  const onClick = () => {
    if (disabled) return;
    setError(null);
    if (props.mode === "navigate") {
      router.push("/quotes");
      return;
    }
    startTransition(async () => {
      try {
        await props.saveAction();
        router.push("/quotes");
      } catch {
        setError(errorMessage);
      }
    });
  };

  return (
    <div className="space-y-2">
      <Button
        aria-label="Dashboard"
        className="w-full sm:w-auto"
        disabled={disabled}
        onClick={onClick}
        type="button"
        variant="outline"
      >
        <Home className="mr-2 h-4 w-4" /> {isPending ? "Saving..." : "Dashboard"}
      </Button>
      {error ? <p className="text-sm text-red-600" role="alert">{error}</p> : null}
    </div>
  );
}

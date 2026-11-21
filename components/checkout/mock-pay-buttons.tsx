"use client";

import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";

export function MockPayButtons({
  paymentId,
  amountLabel,
  payLabel,
  failLabel,
  processingLabel,
}: {
  paymentId: string;
  amountLabel: ReactNode;
  payLabel: string;
  failLabel: string;
  processingLabel: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "success" | "failure">(null);
  const go = async (outcome: "success" | "failure") => {
    setBusy(outcome);
    const res = await fetch("/api/payments/mock/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId, outcome }),
    }).then((r) => r.json());
    if (res.token) router.replace(`/orders/${res.token}?payment=${res.success ? "success" : "failed"}`);
    else setBusy(null);
  };
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => go("success")}
        className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#1c6dd0] font-semibold text-white transition-colors hover:bg-[#155bb0] disabled:opacity-60"
      >
        {busy === "success" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {busy === "success" ? processingLabel : (
          <>
            {payLabel} {amountLabel}
          </>
        )}
      </button>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => go("failure")}
        className="h-10 rounded-xl text-sm font-medium text-[#b91c1c] hover:bg-[#fef2f2] disabled:opacity-60"
      >
        {failLabel}
      </button>
    </div>
  );
}

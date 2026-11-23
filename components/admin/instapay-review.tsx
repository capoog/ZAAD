"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { reviewInstapayAction } from "@/server/actions/admin";

export function InstapayReview({ paymentId }: { paymentId: string }) {
  const t = useTranslations("admin.instapay");
  const router = useRouter();
  const [note, setNote] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [pending, start] = useTransition();
  const decide = (approve: boolean) =>
    start(async () => {
      const r = await reviewInstapayAction({ paymentId, approve, note: note || undefined });
      if (!r.ok) return void toast.error(r.error);
      toast.success(approve ? t("approved") : t("rejected"));
      router.refresh();
    });
  return rejecting ? (
    <div className="flex flex-col gap-2">
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("rejectNote")} maxLength={200} aria-label={t("rejectNote")} />
      <div className="flex gap-2">
        <Button variant="danger" className="flex-1" disabled={pending} onClick={() => decide(false)}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <X aria-hidden />}
          {t("reject")}
        </Button>
        <Button variant="ghost" onClick={() => setRejecting(false)}>
          ✕
        </Button>
      </div>
    </div>
  ) : (
    <div className="flex gap-2">
      <Button variant="zaatar" className="flex-1" disabled={pending} onClick={() => decide(true)}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
        {t("approve")}
      </Button>
      <Button variant="danger" disabled={pending} onClick={() => setRejecting(true)}>
        <X aria-hidden />
        {t("reject")}
      </Button>
    </div>
  );
}

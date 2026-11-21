"use client";

import { useState, useTransition } from "react";
import { KeyRound, Loader2, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { formatPhone, isValidEgyptianMobile, normalizeEgyptianPhone } from "@/lib/phone";
import { requestOtpAction, verifyOtpAction } from "@/server/actions/auth";

export function PhoneLogin() {
  const t = useTranslations("account");
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const phoneOk = isValidEgyptianMobile(phone);

  const send = () =>
    start(async () => {
      const r = await requestOtpAction(phone);
      if (!r.ok) return void toast.error(t(`errors.${r.error}`));
      setDevCode(r.devCode ?? null);
      setStep("code");
    });
  const verify = () =>
    start(async () => {
      const r = await verifyOtpAction({ phone, code });
      if (!r.ok) return void toast.error(t(`errors.${r.error}`));
      router.refresh();
    });

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 rounded-2xl border border-border bg-card p-6 shadow-card">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-ember-900 text-ember-300">
          {step === "phone" ? <Smartphone className="size-7" aria-hidden /> : <KeyRound className="size-7" aria-hidden />}
        </span>
        <h2 className="text-2xl">{t("loginTitle")}</h2>
        <p className="text-sm text-smoke-300">{step === "phone" ? t("loginSubtitle") : t("codeSent", { phone: formatPhone(normalizeEgyptianPhone(phone)) })}</p>
      </div>
      {step === "phone" ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (phoneOk) send();
          }}
        >
          <Field label={t("loginTitle")} htmlFor="login-phone" error={phone.length >= 11 && !phoneOk ? t("errors.INVALID_PHONE") : undefined}>
            <Input
              id="login-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              dir="ltr"
              className="text-start"
              placeholder="01X XXXX XXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          <Button type="submit" size="lg" disabled={!phoneOk || pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {t("sendCode")}
          </Button>
        </form>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length === 6) verify();
          }}
        >
          {devCode && (
            <p role="status" className="rounded-xl border border-dashed border-ember-400/50 bg-ember-900/40 p-3 text-center text-sm text-ember-300">
              {t("demoCode", { code: devCode })}
            </p>
          )}
          <Field label={t("code")} htmlFor="otp">
            <Input
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              maxLength={6}
              className="tabular text-center text-2xl tracking-[0.6em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              autoFocus
            />
          </Field>
          <Button type="submit" size="lg" disabled={code.length !== 6 || pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {t("verify")}
          </Button>
          <div className="flex justify-between text-sm">
            <button type="button" className="text-smoke-300 hover:text-cream-50" onClick={() => setStep("phone")}>
              {t("changePhone")}
            </button>
            <button type="button" className="text-ember-300 hover:underline" onClick={send} disabled={pending}>
              {t("resend")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

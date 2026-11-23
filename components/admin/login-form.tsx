"use client";

import { useState, useTransition } from "react";
import { Loader2, LockKeyhole } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { staffLoginAction } from "@/server/actions/auth";

export function AdminLoginForm() {
  const t = useTranslations("admin.login");
  const te = useTranslations("account.errors");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await staffLoginAction({ email, password });
          if (!r.ok) return void toast.error(te(r.error));
          router.replace("/admin/orders");
          router.refresh();
        });
      }}
    >
      <Field label={t("email")} htmlFor="email">
        <Input id="email" type="email" autoComplete="username" dir="ltr" className="text-start" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field label={t("password")} htmlFor="password">
        <Input id="password" type="password" autoComplete="current-password" dir="ltr" className="text-start" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <LockKeyhole aria-hidden />}
        {t("submit")}
      </Button>
      <p className="text-center text-xs text-smoke-400">{t("demo")}</p>
    </form>
  );
}

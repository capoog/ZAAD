"use client";

import { useState, useTransition } from "react";
import { Loader2, UserPlus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { addStaffAction, removeRoleAction } from "@/server/actions/admin";

type Role = "owner" | "manager" | "kitchen" | "driver";
interface Member {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  roles: Role[];
}

export function StaffManager({ members, meId }: { members: Member[]; meId: string }) {
  const t = useTranslations("admin.staff");
  const tr = useTranslations("admin.roles");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "kitchen" as Role });
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        if (ok) toast.success(ok);
      } else if (r.error === "EXISTS") toast.success(t("errors.EXISTS"));
      else toast.error(["WEAK", "SELF"].includes(r.error ?? "") ? t(`errors.${r.error as "WEAK"}`) : (r.error ?? "error"));
      router.refresh();
    });

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[1fr_22rem]">
      <ul className="flex flex-col gap-2.5">
        {members.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
            <span className="grid size-10 place-items-center rounded-full bg-coal-700 font-display text-ember-300">{(m.name ?? m.email ?? "?").charAt(0)}</span>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">
                {m.name ?? "—"} {m.id === meId && <span className="text-xs text-smoke-400">({t("you")})</span>}
              </p>
              <p className="text-xs text-smoke-400" dir="ltr">
                {m.email}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {m.roles.map((r) => (
                <Badge key={r} variant={r === "owner" ? "solid" : r === "manager" ? "ember" : r === "kitchen" ? "flame" : "zaatar"} className="gap-1 pe-1">
                  {tr(r)}
                  <button type="button" aria-label={`${t("remove")}: ${tr(r)}`} disabled={pending} onClick={() => act(() => removeRoleAction({ userId: m.id, role: r }))} className="grid size-4 place-items-center rounded-full hover:bg-black/20">
                    <X className="size-3" aria-hidden />
                  </button>
                </Badge>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <form
        className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card"
        onSubmit={(e) => {
          e.preventDefault();
          act(() => addStaffAction(form), t("added"));
        }}
      >
        <h2 className="font-sans text-base font-semibold">{t("add")}</h2>
        <Field label={t("name")} htmlFor="sn">
          <Input id="sn" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </Field>
        <Field label={t("email")} htmlFor="se">
          <Input id="se" type="email" dir="ltr" className="text-start" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </Field>
        <Field label={t("password")} htmlFor="sp">
          <Input id="sp" type="password" dir="ltr" className="text-start" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={10} />
        </Field>
        <Field label={t("role")} htmlFor="sr">
          <NativeSelect id="sr" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            {(["manager", "kitchen", "driver", "owner"] as const).map((r) => (
              <option key={r} value={r}>
                {tr(r)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <UserPlus aria-hidden />}
          {t("add")}
        </Button>
      </form>
    </div>
  );
}

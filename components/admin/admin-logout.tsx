"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { logoutAction } from "@/server/actions/auth";

export function AdminLogout() {
  const t = useTranslations("admin.nav");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => { await logoutAction(); router.replace("/admin/login"); router.refresh(); })}
      className="flex h-10 items-center gap-2 rounded-full px-3 text-sm text-smoke-300 hover:bg-coal-800 hover:text-cream-50"
    >
      <LogOut className="size-4" aria-hidden />
      {t("logout")}
    </button>
  );
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { AdminLogout } from "@/components/admin/admin-logout";
import { AdminNav, type AdminSection } from "@/components/admin/admin-nav";
import { LocaleSwitch } from "@/components/common/locale-switch";
import { Link } from "@/i18n/navigation";
import { requireStaffPage } from "@/server/auth/guard";
import { pendingInstapay } from "@/server/services/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireStaffPage(locale);
  const t = await getTranslations("admin");
  const isManager = session.roles.some((r) => r === "owner" || r === "manager");
  const sections: AdminSection[] = ["orders"];
  if (isManager || session.roles.includes("kitchen")) sections.push("menu");
  if (isManager) sections.push("instapay", "analytics", "settings");
  if (session.roles.includes("owner")) sections.push("staff");
  const pending = isManager ? (await pendingInstapay()).length : 0;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-e border-border bg-coal-950/60 p-4 lg:flex">
        <Link href="/admin/orders" className="px-2 pt-2">
          <Logo className="h-10" />
        </Link>
        <AdminNav sections={sections} pendingInstapay={pending} variant="side" />
        <div className="mt-auto flex flex-col gap-3 rounded-xl border border-border bg-coal-850 p-3">
          <div className="text-sm">
            <p className="font-semibold">{session.fullName ?? session.email}</p>
            <p className="text-xs text-smoke-400">{session.roles.map((r) => t(`roles.${r}`)).join(" · ")}</p>
          </div>
          <div className="flex items-center justify-between">
            <AdminLogout />
            <LocaleSwitch className="h-9 px-3" />
          </div>
        </div>
      </aside>
      <div className="min-w-0 pb-24 lg:pb-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-coal-900/80 px-4 backdrop-blur-xl lg:hidden">
          <Link href="/admin/orders">
            <Logo className="h-8" />
          </Link>
          <div className="flex items-center gap-1">
            <LocaleSwitch className="h-9 px-3" />
            <AdminLogout />
          </div>
        </header>
        <main id="main" className="mx-auto max-w-[110rem] p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
      <AdminNav sections={sections} pendingInstapay={pending} variant="bottom" />
    </div>
  );
}

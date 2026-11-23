import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { AdminLoginForm } from "@/components/admin/login-form";
import { LocaleSwitch } from "@/components/common/locale-switch";
import { getSession } from "@/server/auth/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminLoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSession();
  if (session?.roles.length) redirect(`${locale === "en" ? "/en" : ""}/admin/orders`);
  const t = await getTranslations("admin.login");
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center justify-between">
          <Logo className="h-11" />
          <LocaleSwitch />
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-lift">
          <h1 className="mb-5 text-2xl">{t("title")}</h1>
          <AdminLoginForm />
        </div>
      </div>
    </main>
  );
}

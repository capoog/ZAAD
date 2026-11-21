import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

// Phase 1 review build: the storefront arrives in phase 2.
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  redirect({ href: "/style-guide", locale });
}

import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { LocaleSwitch } from "@/components/common/locale-switch";
import { Link } from "@/i18n/navigation";
import { CartButton } from "./cart-button";
import { MobileNav } from "./mobile-nav";

export async function SiteHeader() {
  const t = await getTranslations("nav");
  const links = [
    { href: "/", label: t("home") },
    { href: "/menu", label: t("menu") },
    { href: "/#offers", label: t("offers") },
    { href: "/#location", label: t("location") },
    { href: "/orders", label: t("myOrders") },
  ];
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-coal-900/75 backdrop-blur-xl supports-[backdrop-filter]:bg-coal-900/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 md:h-18 lg:px-8">
        <Link href="/" aria-label={t("home")} className="shrink-0">
          <Logo className="h-9 md:h-11" />
        </Link>
        <nav aria-label="primary" className="ms-8 hidden items-center gap-1 md:flex">
          {links.slice(1).map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full px-4 py-2 text-[0.95rem] font-medium text-smoke-200 transition-colors hover:bg-coal-800 hover:text-cream-50"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-2">
          <LocaleSwitch className="hidden md:inline-flex" />
          <CartButton />
          <MobileNav links={links} />
        </div>
      </div>
    </header>
  );
}

import { SearchX } from "lucide-react";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("notFound");
  return (
    <main id="main" className="mx-auto flex min-h-[80vh] max-w-xl flex-col items-center justify-center gap-6 px-4">
      <Link href="/" aria-label={t("home")}>
        <Logo className="h-12" />
      </Link>
      <EmptyState
        icon={<SearchX aria-hidden />}
        title={t("title")}
        description={t("body")}
        action={
          <div className="flex gap-3">
            <Button asChild>
              <Link href="/menu">{t("menu")}</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/">{t("home")}</Link>
            </Button>
          </div>
        }
      />
    </main>
  );
}

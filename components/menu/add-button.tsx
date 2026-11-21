"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCatalog } from "@/components/providers/catalog-provider";
import { Link, useRouter } from "@/i18n/navigation";
import { useCart } from "@/lib/cart-store";
import { cn } from "@/lib/utils";

/** Quick add: adds simple dishes instantly; dishes with sizes/required options open their page. */
export function AddButton({ slug, size = "icon", className }: { slug: string; size?: "icon" | "icon-sm"; className?: string }) {
  const { itemsBySlug } = useCatalog();
  const locale = useLocale();
  const t = useTranslations("menu");
  const tc = useTranslations("common");
  const add = useCart((s) => s.add);
  const router = useRouter();
  const [pop, setPop] = useState(0);
  const item = itemsBySlug.get(slug);
  if (!item) return null;
  const name = locale === "en" ? item.nameEn : item.nameAr;
  const needsChoice = item.sizes.length > 0 || item.addonGroups.some((g) => g.minSelect > 0);
  const label = `${tc("addToCart")}: ${name}`;

  if (item.isSoldOut) {
    return (
      <Button size={size} disabled aria-label={label} className={className}>
        <Plus aria-hidden />
      </Button>
    );
  }
  if (needsChoice) {
    return (
      <Button size={size} asChild className={className}>
        <Link href={`/menu/${slug}`} aria-label={label}>
          <Plus aria-hidden />
        </Link>
      </Button>
    );
  }
  return (
    <Button
      size={size}
      aria-label={label}
      className={cn(pop && "animate-pop", className)}
      key={pop}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        add({ menuItemId: item.id, slug, sizeId: null, addonIds: [], quantity: 1, notes: "" });
        setPop((p) => p + 1);
        toast.success(t("addedToast", { name }), {
          action: { label: t("viewCartAction"), onClick: () => router.push("/cart") },
        });
      }}
    >
      <Plus aria-hidden />
    </Button>
  );
}

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { CartBar } from "@/components/cart/cart-bar";
import { useCartView, useCatalog } from "@/components/providers/catalog-provider";
import { usePathname } from "@/i18n/navigation";
import type { AppLocale } from "@/lib/money";
import { cn } from "@/lib/utils";

const HIDE_CART_ON = ["/cart", "/checkout"];

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className} fill="currentColor">
      <path d="M16.04 3C8.86 3 3.02 8.83 3.02 16c0 2.29.6 4.53 1.74 6.5L3 29l6.68-1.75A13 13 0 0 0 16.04 29C23.2 29 29.04 23.17 29.04 16S23.2 3 16.04 3Zm0 23.7c-2.02 0-4-.54-5.72-1.57l-.41-.24-3.96 1.04 1.06-3.86-.27-.4A10.62 10.62 0 0 1 5.4 16c0-5.86 4.78-10.63 10.64-10.63 5.86 0 10.63 4.77 10.63 10.63S21.9 26.7 16.04 26.7Zm5.83-7.96c-.32-.16-1.89-.93-2.18-1.04-.3-.1-.5-.16-.72.16-.21.32-.82 1.04-1 1.25-.19.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.59-.95-.85-1.59-1.9-1.78-2.22-.18-.32-.02-.49.14-.65.15-.14.32-.37.48-.56.16-.18.21-.32.32-.53.1-.21.05-.4-.03-.56-.08-.16-.72-1.73-.98-2.37-.26-.62-.52-.54-.72-.55h-.61c-.21 0-.56.08-.85.4-.29.32-1.12 1.09-1.12 2.66s1.14 3.08 1.3 3.3c.16.2 2.25 3.43 5.44 4.81.76.33 1.35.52 1.81.67.76.24 1.46.2 2 .12.61-.09 1.89-.77 2.15-1.52.27-.74.27-1.38.19-1.52-.08-.13-.29-.21-.61-.37Z" />
    </svg>
  );
}

export function FloatingActions() {
  const locale = useLocale() as AppLocale;
  const t = useTranslations();
  const pathname = usePathname();
  const { settings } = useCatalog();
  const { count, pricing, hydrated } = useCartView();
  const showCart = hydrated && count > 0 && !HIDE_CART_ON.some((p) => pathname.startsWith(p)) && !pathname.startsWith("/menu/");
  const wa = `https://wa.me/${settings.restaurant.whatsapp}?text=${encodeURIComponent(t("whatsappMessage"))}`;

  return (
    <>
      <a
        href={wa}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("common.whatsapp")}
        className={cn(
          "fixed end-4 z-40 grid size-14 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_12px_30px_-10px_rgb(37_211_102/0.7)] transition-[bottom,transform] duration-300 hover:scale-105 md:end-6",
          showCart ? "bottom-24 md:bottom-28" : "bottom-[max(1.25rem,env(safe-area-inset-bottom))] md:bottom-6",
          pathname.startsWith("/menu/") && "hidden",
        )}
      >
        <WhatsAppIcon className="size-7" />
      </a>
      <AnimatePresence>
        {showCart && (
          <motion.div
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="fixed inset-x-0 bottom-0 z-40 md:inset-x-auto md:start-6 md:bottom-6"
          >
            <CartBar count={count} totalPiasters={pricing.totalPiasters} locale={locale} floating={false} href="/cart" className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-0 md:pb-0" />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

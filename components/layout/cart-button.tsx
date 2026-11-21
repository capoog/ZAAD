"use client";

import { ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "@/i18n/navigation";
import { useCartView } from "@/components/providers/catalog-provider";

export function CartButton() {
  const t = useTranslations("nav");
  const { count } = useCartView();
  return (
    <Link
      href="/cart"
      aria-label={`${t("cart")} (${count})`}
      className="relative grid size-11 place-items-center rounded-full border border-border-strong bg-coal-850 text-cream-100 transition-colors hover:border-ember-400/60"
    >
      <ShoppingBag className="size-5" aria-hidden />
      <AnimatePresence>
        {count > 0 && (
          <motion.span
            key={count}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 22 }}
            className="tabular absolute -end-1 -top-1 grid min-w-5.5 place-items-center rounded-full bg-ember-400 px-1 text-[0.7rem] font-bold text-coal-950"
          >
            {count}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}

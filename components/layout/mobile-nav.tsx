"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import { Link, usePathname } from "@/i18n/navigation";
import { LocaleSwitch } from "@/components/common/locale-switch";
import { cn } from "@/lib/utils";

export function MobileNav({ links }: { links: { href: string; label: string }[] }) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("openMenu")}
        aria-expanded={open}
        className="grid size-11 place-items-center rounded-full border border-border-strong bg-coal-850 md:hidden"
      >
        <Menu className="size-5" aria-hidden />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[60] bg-coal-950/80 backdrop-blur-md md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.nav
              aria-label={t("openMenu")}
              initial={{ y: -24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -24, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              className="m-3 rounded-2xl border border-border-strong bg-coal-850 p-3 shadow-lift"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-2">
                <LocaleSwitch />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={t("closeMenu")}
                  className="grid size-11 place-items-center rounded-full bg-coal-700"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>
              <ul className="mt-2 flex flex-col">
                {links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className={cn(
                        "flex h-14 items-center rounded-xl px-4 font-display text-xl transition-colors hover:bg-coal-700",
                        pathname === l.href && "text-ember-400",
                      )}
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

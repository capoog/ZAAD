"use client";

/* eslint-disable @next/next/no-img-element -- tiny static brand mark */
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";

const KEY = "fz-intro-seen";
const SHOW_MS = 2600;
const LEAVE_MS = 700;

// Deterministic ember particles (no hydration mismatch).
const EMBERS = Array.from({ length: 18 }, (_, i) => ({
  left: (i * 53) % 100,
  delay: ((i * 37) % 17) / 10,
  duration: 2.2 + ((i * 29) % 13) / 10,
  size: 2 + ((i * 7) % 4),
}));

/**
 * Cinematic intro shown once per browser session before entering the site:
 * charcoal glow → flame ignites → wordmark wipes in → curtain lifts.
 * Skippable (tap / any key), and skipped entirely for reduced-motion users
 * (see the inline script in the locale layout, which prevents any flash).
 */
export function IntroSplash() {
  const t = useTranslations("intro");
  const [phase, setPhase] = useState<"show" | "leave" | "gone">("show");

  const leave = useCallback(() => {
    setPhase((p) => (p === "show" ? "leave" : p));
  }, []);

  useEffect(() => {
    const skip = document.documentElement.dataset.intro === "skip";
    if (skip) {
      setPhase("gone");
      return;
    }
    document.documentElement.style.overflow = "hidden";
    const a = window.setTimeout(leave, SHOW_MS);
    const onKey = () => leave();
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(a);
      window.removeEventListener("keydown", onKey);
    };
  }, [leave]);

  useEffect(() => {
    if (phase !== "leave") return;
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {}
    const b = window.setTimeout(() => {
      setPhase("gone");
      document.documentElement.style.overflow = "";
      document.documentElement.dataset.intro = "skip";
    }, LEAVE_MS);
    return () => window.clearTimeout(b);
  }, [phase]);

  if (phase === "gone") return null;

  return (
    <div
      aria-hidden
      onClick={leave}
      className={`fz-intro fixed inset-0 z-[200] grid cursor-pointer place-items-center overflow-hidden bg-coal-950 ${phase === "leave" ? "fz-intro-leave" : ""}`}
    >
      <div className="fz-intro-glow absolute inset-x-0 bottom-[-30%] h-[90%] bg-[radial-gradient(50%_50%_at_50%_50%,rgb(255_120_40/0.45),rgb(255_80_20/0.12)_45%,transparent_70%)]" />
      <div className="grain pointer-events-none absolute inset-0" />
      {EMBERS.map((e, i) => (
        <span
          key={i}
          className="fz-ember absolute bottom-[-10px] rounded-full bg-flame-400"
          style={{ left: `${e.left}%`, width: e.size, height: e.size, animationDelay: `${e.delay}s`, animationDuration: `${e.duration}s` }}
        />
      ))}

      <div className="relative flex flex-col items-center gap-5 px-6 text-center">
        <div className="fz-intro-mark">
          <Logo variant="mark" className="h-24 w-auto drop-shadow-[0_0_40px_rgb(255_138_69/0.6)] md:h-28" />
        </div>
        <div className="fz-intro-word">
          <Logo variant="wordmark" className="h-16 w-auto md:h-20" />
        </div>
        <p className="fz-intro-tag font-display text-lg text-smoke-200 md:text-xl">{t("tagline")}</p>
      </div>

      <div className="fz-intro-credit absolute inset-x-0 bottom-[max(2rem,env(safe-area-inset-bottom))] flex items-center justify-center gap-2.5 text-sm text-smoke-300">
        {t("devBy")}
        <img src="/brand/seen-mark.png" alt="" width={32} height={32} className="size-8 rounded-lg" />
        <span className="font-display font-bold text-[#C0FF72]">{t("devName")}</span>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-coal-800">
        <div className="fz-intro-progress h-full origin-[var(--fz-origin)] bg-gradient-to-l from-flame-400 to-ember-500" />
      </div>
      <span className="absolute end-5 top-[max(1.25rem,env(safe-area-inset-top))] rounded-full border border-border-strong px-3 py-1 text-xs text-smoke-300">
        {t("skip")}
      </span>
    </div>
  );
}

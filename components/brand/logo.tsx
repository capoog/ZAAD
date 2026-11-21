import { useId } from "react";
import { cn } from "@/lib/utils";
import { LOGO, MARK } from "./logo-paths";

function MarkShapes({ gradientId }: { gradientId: string }) {
  return (
    <>
      <path d={MARK.flame} fill={`url(#${gradientId})`} />
      <path d={MARK.leaf} fill="#1A1410" />
      <path d={MARK.rib} fill="none" stroke="#A3B46B" strokeWidth={1.6} strokeLinecap="round" />
      {MARK.bars.map((b) => (
        <rect key={b.y} x={b.x} y={b.y} width={b.w} height={b.h} rx={b.h / 2} fill="#F3E9DA" opacity={0.9} />
      ))}
    </>
  );
}

function Gradient({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FFC65C" />
        <stop offset="0.55" stopColor="#FF8A45" />
        <stop offset="1" stopColor="#E4561A" />
      </linearGradient>
    </defs>
  );
}

/**
 * Brand lockup drawn from outlined paths (see scripts/build-logo.mjs), so it
 * renders identically everywhere and needs no font.
 */
export function Logo({
  variant = "full",
  className,
  title = "فحم وزعتر — Fahm & Zaatar",
}: {
  variant?: "full" | "mark" | "wordmark";
  className?: string;
  title?: string;
}) {
  const gid = `fz-ember-${useId().replace(/:/g, "")}`;
  if (variant === "mark") {
    return (
      <svg viewBox="0 0 64 64" role="img" aria-label={title} className={cn("h-10 w-auto", className)}>
        <Gradient id={gid} />
        <MarkShapes gradientId={gid} />
      </svg>
    );
  }
  if (variant === "wordmark") {
    return (
      <svg
        viewBox={`0 0 ${LOGO.textWidth} ${LOGO.height}`}
        role="img"
        aria-label={title}
        className={cn("h-10 w-auto", className)}
      >
        <path d={LOGO.wordmarkAr} fill="currentColor" className="text-cream-100" />
        <path d={LOGO.wordmarkEn} className="fill-ember-400" />
      </svg>
    );
  }
  return (
    <svg viewBox={`0 0 ${LOGO.width} ${LOGO.height}`} role="img" aria-label={title} className={cn("h-10 w-auto", className)}>
      <Gradient id={gid} />
      <path d={LOGO.wordmarkAr} className="fill-cream-100" />
      <path d={LOGO.wordmarkEn} className="fill-ember-400" />
      <g transform={`translate(${LOGO.mark.x} ${LOGO.mark.y})`}>
        <MarkShapes gradientId={gid} />
      </g>
    </svg>
  );
}

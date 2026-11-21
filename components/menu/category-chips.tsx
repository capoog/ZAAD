"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface ChipItem {
  slug: string;
  label: string;
  count?: number;
}

/** Horizontally scrolling category bar (made sticky by its container). */
export function CategoryChips({
  items,
  active,
  onSelect,
  ariaLabel,
}: {
  items: ChipItem[];
  active?: string;
  onSelect?: (slug: string) => void;
  ariaLabel: string;
}) {
  const [current, setCurrent] = useState(active ?? items[0]?.slug);
  const selected = active ?? current;
  return (
    <nav aria-label={ariaLabel} className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 py-1">
      {items.map((it) => {
        const on = it.slug === selected;
        return (
          <button
            key={it.slug}
            type="button"
            aria-current={on ? "true" : undefined}
            onClick={() => {
              setCurrent(it.slug);
              onSelect?.(it.slug);
            }}
            className={cn(
              "flex h-10 shrink-0 snap-start items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-[background-color,border-color,color,box-shadow] duration-200",
              on
                ? "border-ember-400 bg-ember-400 text-coal-950 shadow-ember"
                : "border-border-strong bg-coal-850 text-cream-100 hover:border-ember-400/50",
            )}
          >
            {it.label}
            {it.count !== undefined && (
              <span className={cn("tabular text-xs", on ? "text-coal-950/70" : "text-smoke-400")}>{it.count}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

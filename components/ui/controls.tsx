"use client";

import * as React from "react";
import { Checkbox as CheckboxPrimitive, RadioGroup as RadioPrimitive, Switch as SwitchPrimitive } from "radix-ui";
import { Check, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border border-border-strong bg-coal-700 p-0.5 transition-colors data-[state=checked]:border-ember-400/50 data-[state=checked]:bg-ember-400 disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-5.5 rounded-full bg-cream-100 shadow-md transition-transform duration-200 ease-[var(--ease-spring)] data-[state=checked]:translate-x-5 data-[state=checked]:bg-coal-950 rtl:data-[state=checked]:-translate-x-5" />
    </SwitchPrimitive.Root>
  );
}

export function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "grid size-5.5 shrink-0 place-items-center rounded-[0.4rem] border border-border-strong bg-coal-850 transition-colors data-[state=checked]:border-ember-400 data-[state=checked]:bg-ember-400 data-[state=checked]:text-coal-950",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Check className="size-4" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export const RadioGroup = RadioPrimitive.Root;

/** A full-width selectable row (sizes, payment methods, delivery vs pickup). */
export function RadioCard({
  className,
  children,
  ...props
}: React.ComponentProps<typeof RadioPrimitive.Item>) {
  return (
    <RadioPrimitive.Item
      className={cn(
        "group flex w-full cursor-pointer items-center gap-3 rounded-lg border border-border-strong bg-coal-850 p-4 text-start transition-[border-color,background-color,box-shadow] hover:border-ember-400/40 data-[state=checked]:border-ember-400 data-[state=checked]:bg-ember-900/30 data-[state=checked]:shadow-[0_0_0_4px_rgb(255_138_69/0.12)] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="grid size-5 shrink-0 place-items-center rounded-full border-2 border-smoke-400 transition-colors group-data-[state=checked]:border-ember-400">
        <RadioPrimitive.Indicator className="size-2.5 rounded-full bg-ember-400" />
      </span>
      {children}
    </RadioPrimitive.Item>
  );
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 50,
  size = "md",
  labels,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  size?: "sm" | "md";
  labels: { decrease: string; increase: string; quantity: string };
}) {
  const btn = size === "sm" ? "size-8" : "size-10";
  return (
    <div
      className="inline-flex items-center gap-1 rounded-full border border-border-strong bg-coal-850 p-1"
      role="group"
      aria-label={labels.quantity}
    >
      <button
        type="button"
        className={cn(btn, "grid place-items-center rounded-full text-cream-100 transition-colors hover:bg-coal-700 disabled:opacity-35")}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={labels.decrease}
      >
        <Minus className="size-4" />
      </button>
      <output aria-live="polite" className={cn("tabular min-w-7 text-center font-semibold", size === "sm" ? "text-sm" : "text-base")}>
        {value}
      </output>
      <button
        type="button"
        className={cn(btn, "grid place-items-center rounded-full bg-ember-400 text-coal-950 transition-colors hover:bg-ember-300 disabled:opacity-35")}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={labels.increase}
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

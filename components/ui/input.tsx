import * as React from "react";
import { cn } from "@/lib/utils";

export const inputBase =
  "w-full rounded-md border border-border-strong bg-input px-4 text-[0.95rem] text-cream-100 placeholder:text-smoke-400 transition-[border-color,box-shadow] outline-none focus-visible:outline-none focus:border-ember-400/70 focus:ring-4 focus:ring-ember-400/15 aria-[invalid=true]:border-chili-400/70 aria-[invalid=true]:ring-chili-400/15 disabled:opacity-50";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input data-slot="input" className={cn(inputBase, "h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea data-slot="textarea" className={cn(inputBase, "min-h-24 py-3 leading-relaxed", className)} {...props} />;
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium text-cream-100", className)} {...props} />;
}

export function NativeSelect({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        data-slot="select"
        className={cn(inputBase, "h-12 appearance-none pe-11", className)}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className="pointer-events-none absolute end-4 top-1/2 size-4 -translate-y-1/2 text-smoke-300"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-sm text-chili-400">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-sm text-smoke-300">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

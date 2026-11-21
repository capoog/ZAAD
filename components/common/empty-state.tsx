import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}>
      <div className="relative mb-2 grid size-24 place-items-center rounded-full border border-border-strong bg-coal-850 text-ember-400 shadow-[inset_0_-20px_40px_-20px_rgb(255_138_69/0.35)]">
        <div aria-hidden className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_120%,rgb(255_138_69/0.35),transparent_60%)]" />
        <span className="relative [&_svg]:size-10">{icon}</span>
      </div>
      <h3 className="font-sans text-lg font-semibold">{title}</h3>
      {description && <p className="max-w-xs text-sm text-smoke-300">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

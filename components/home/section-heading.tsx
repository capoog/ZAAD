import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionHeading({
  title,
  subtitle,
  action,
  id,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-7 flex items-end justify-between gap-4", className)}>
      <div className="flex flex-col gap-1.5">
        <h2 id={id} className="text-3xl md:text-4xl">
          {title}
        </h2>
        {subtitle && <p className="text-sm text-smoke-300 md:text-base">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

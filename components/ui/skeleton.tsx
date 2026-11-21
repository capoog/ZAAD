import { cn } from "@/lib/utils";

/**
 * Loading placeholder. Solid block for reduced-motion users; a soft shimmer
 * sweep otherwise. Uses coal-700 so it stays visible on coal-800 cards.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative overflow-hidden rounded-md bg-coal-700",
        "motion-safe:after:absolute motion-safe:after:inset-0 motion-safe:after:animate-shimmer motion-safe:after:bg-[linear-gradient(100deg,transparent_30%,rgb(243_233_218/0.06)_50%,transparent_70%)] motion-safe:after:bg-[length:200%_100%] motion-safe:after:content-['']",
        className,
      )}
      {...props}
    />
  );
}

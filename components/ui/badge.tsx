import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-5 [&_svg]:size-3.5",
  {
    variants: {
      variant: {
        default: "border-border-strong bg-coal-800/80 text-cream-100",
        ember: "border-ember-400/30 bg-ember-900/70 text-ember-300",
        flame: "border-flame-400/30 bg-flame-400/10 text-flame-300",
        zaatar: "border-zaatar-400/30 bg-zaatar-900/80 text-zaatar-300",
        chili: "border-chili-400/30 bg-chili-900/80 text-chili-400",
        solid: "border-transparent bg-ember-400 text-coal-950",
        glass: "border-white/10 bg-coal-950/55 text-cream-100 backdrop-blur-md",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

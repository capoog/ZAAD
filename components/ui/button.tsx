import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap font-semibold transition-[background-color,box-shadow,transform,color] duration-200 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-[1.15em] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-ember-400 text-coal-950 shadow-ember hover:bg-ember-300 hover:shadow-ember-lg bg-[linear-gradient(180deg,rgb(255_255_255/0.18),transparent_55%)]",
        secondary: "bg-coal-700 text-cream-100 hover:bg-coal-600 shadow-card",
        outline: "border border-border-strong bg-transparent text-cream-100 hover:bg-coal-800 hover:border-ember-400/50",
        ghost: "bg-transparent text-cream-100 hover:bg-coal-800",
        zaatar: "bg-zaatar-400 text-coal-950 hover:bg-zaatar-300",
        danger: "bg-chili-900 text-chili-400 border border-chili-400/30 hover:bg-chili-600/30",
        link: "h-auto rounded-none bg-transparent p-0 text-ember-300 underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 rounded-full px-4 text-sm",
        md: "h-11 rounded-full px-5 text-[0.95rem]",
        lg: "h-14 rounded-full px-7 text-base",
        icon: "size-11 rounded-full",
        "icon-sm": "size-9 rounded-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...(asChild ? {} : { type: type ?? "button" })}
      {...props}
    />
  );
}

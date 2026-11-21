"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="top-center"
      offset={16}
      mobileOffset={12}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-2xl !border !border-border-strong !bg-coal-800/95 !text-cream-100 !shadow-lift backdrop-blur-xl !font-sans !gap-3",
          title: "!font-semibold !text-[0.95rem]",
          description: "!text-smoke-300",
          icon: "!text-ember-400",
          success: "[&_[data-icon]]:!text-zaatar-400",
          error: "[&_[data-icon]]:!text-chili-400",
          actionButton: "!rounded-full !bg-ember-400 !text-coal-950 !font-semibold",
        },
      }}
      {...props}
    />
  );
}

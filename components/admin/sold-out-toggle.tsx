"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/controls";
import { toggleSoldOutAction } from "@/server/actions/admin";

export function SoldOutToggle({ itemId, soldOut, label }: { itemId: string; soldOut: boolean; label: string }) {
  const [value, setValue] = useState(!soldOut);
  const [pending, start] = useTransition();
  return (
    <Switch
      aria-label={label}
      checked={value}
      disabled={pending}
      onCheckedChange={(available) => {
        setValue(available);
        start(async () => {
          const r = await toggleSoldOutAction({ itemId, soldOut: !available });
          if (!r.ok) {
            setValue(!available);
            toast.error(r.error);
          }
        });
      }}
    />
  );
}

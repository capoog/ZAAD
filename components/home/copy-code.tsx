"use client";

import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyCode({ code }: { code: string }) {
  const t = useTranslations("home");
  return (
    <Button
      size="sm"
      variant="secondary"
      className="relative z-10 border border-dashed border-ember-400/50 bg-coal-950/60 font-mono tracking-wider text-ember-300 backdrop-blur"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
        } catch {
          /* clipboard can be blocked; the toast still shows the code */
        }
        toast.success(t("codeCopied"), { description: code });
      }}
      aria-label={`${t("copyCode")}: ${code}`}
    >
      <Copy aria-hidden />
      {code}
    </Button>
  );
}

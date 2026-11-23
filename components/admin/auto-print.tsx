"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";

export function AutoPrint({ label }: { label: string }) {
  useEffect(() => {
    const id = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <button type="button" onClick={() => window.print()} className="print:hidden mx-auto mt-6 flex items-center gap-2 rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white">
      <Printer className="size-4" aria-hidden />
      {label}
    </button>
  );
}

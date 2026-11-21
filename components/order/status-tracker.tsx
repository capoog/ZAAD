import { Bike, ChefHat, CheckCircle2, ReceiptText, ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { trackingSteps, type Fulfillment, type OrderStatus } from "@/lib/order-status";
import { cn } from "@/lib/utils";

const ICONS: Partial<Record<OrderStatus, typeof ReceiptText>> = {
  received: ReceiptText,
  preparing: ChefHat,
  out_for_delivery: Bike,
  ready_for_pickup: ShoppingBag,
  delivered: CheckCircle2,
};

/** Received → Preparing → Out for delivery → Delivered */
export function StatusTracker({ status, fulfillment }: { status: OrderStatus; fulfillment: Fulfillment }) {
  const t = useTranslations("status");
  const hint = useTranslations("statusHint");
  const steps = trackingSteps(fulfillment);
  const current = Math.max(0, steps.indexOf(status));
  const pct = steps.length > 1 ? (current / (steps.length - 1)) * 100 : 0;

  return (
    <div className="w-full">
      <ol className="relative grid grid-cols-4 gap-1" aria-label={t(status)}>
        <div aria-hidden className="absolute inset-x-[12.5%] top-6 h-1 rounded-full bg-coal-700" />
        <div
          aria-hidden
          className="absolute start-[12.5%] top-6 h-1 rounded-full bg-gradient-to-l from-flame-400 to-ember-500 shadow-[0_0_16px_rgb(255_138_69/0.6)] transition-[width] duration-700 ltr:bg-gradient-to-r"
          style={{ width: `${pct * 0.75}%` }}
        />
        {steps.map((step, i) => {
          const Icon = ICONS[step] ?? ReceiptText;
          const done = i < current;
          const active = i === current;
          return (
            <li key={step} className="relative z-10 flex flex-col items-center gap-2 text-center" aria-current={active ? "step" : undefined}>
              <span
                className={cn(
                  "grid size-13 place-items-center rounded-full border-2 transition-all duration-500",
                  done && "border-ember-400 bg-ember-400 text-coal-950",
                  active && "border-ember-400 bg-coal-900 text-ember-400 shadow-[0_0_0_6px_rgb(255_138_69/0.15),0_0_30px_rgb(255_138_69/0.45)]",
                  !done && !active && "border-coal-600 bg-coal-850 text-smoke-400",
                )}
              >
                <Icon className={cn("size-5.5", active && "animate-ember-flicker")} aria-hidden />
              </span>
              <span className={cn("text-xs font-semibold leading-tight sm:text-sm", active ? "text-cream-50" : done ? "text-smoke-200" : "text-smoke-400")}>
                {t(step)}
              </span>
            </li>
          );
        })}
      </ol>
      {status !== "cancelled" && status !== "pending_payment" && (
        <p className="mt-5 text-center text-sm text-smoke-300">{hint(status as "received")}</p>
      )}
    </div>
  );
}

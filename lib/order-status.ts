export type OrderStatus =
  | "pending_payment"
  | "received"
  | "preparing"
  | "ready_for_pickup"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type Fulfillment = "delivery" | "pickup";

/** Customer-facing tracking steps. */
export function trackingSteps(fulfillment: Fulfillment): OrderStatus[] {
  return fulfillment === "delivery"
    ? ["received", "preparing", "out_for_delivery", "delivered"]
    : ["received", "preparing", "ready_for_pickup", "delivered"];
}

/** Allowed next statuses for staff, by fulfillment type. */
export function nextStatuses(current: OrderStatus, fulfillment: Fulfillment): OrderStatus[] {
  const forward: Record<OrderStatus, OrderStatus[]> = {
    pending_payment: ["received"],
    received: ["preparing"],
    preparing: [fulfillment === "delivery" ? "out_for_delivery" : "ready_for_pickup"],
    ready_for_pickup: ["delivered"],
    out_for_delivery: ["delivered"],
    delivered: [],
    cancelled: [],
  };
  const list = [...forward[current]];
  if (current !== "delivered" && current !== "cancelled") list.push("cancelled");
  return list;
}

export function canTransition(from: OrderStatus, to: OrderStatus, fulfillment: Fulfillment): boolean {
  return nextStatuses(from, fulfillment).includes(to);
}

export const ACTIVE_STATUSES: OrderStatus[] = [
  "received",
  "preparing",
  "ready_for_pickup",
  "out_for_delivery",
];

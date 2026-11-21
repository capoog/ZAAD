import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TrackingView } from "@/components/order/tracking-view";
import { getOrderDetail } from "@/server/services/orders";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Guest-friendly tracking: the unguessable token in the URL is the credential. */
export default async function TrackOrderPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  if (!/^[a-f0-9]{32}$/.test(token)) notFound();
  const order = await getOrderDetail({ token });
  if (!order) notFound();
  const t = await getTranslations("order");
  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 pb-16 sm:px-6 md:pt-12 lg:px-8">
      <h1 className="mb-7 text-3xl md:text-5xl">{t("thanks", { name: order.customerName.split(" ")[0] ?? "" })}</h1>
      <TrackingView order={order} />
    </div>
  );
}

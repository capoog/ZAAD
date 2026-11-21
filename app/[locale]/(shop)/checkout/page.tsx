import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { desc } from "drizzle-orm";
import { CheckoutForm, type SavedAddress } from "@/components/checkout/checkout-form";
import { getSession } from "@/server/auth/session";
import { asUser } from "@/server/db";
import * as s from "@/server/db/schema";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "checkout" });
  return { title: t("title"), robots: { index: false } };
}

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("checkout");
  const session = await getSession();
  // Saved addresses are read through Row Level Security as the signed-in user.
  const addresses: SavedAddress[] = session
    ? (await asUser(session.userId, (tx) => tx.select().from(s.addresses).orderBy(desc(s.addresses.isDefault), desc(s.addresses.createdAt)))).map(
        (a) => ({
          id: a.id,
          zoneId: a.zoneId,
          street: a.street,
          building: a.building,
          floor: a.floor,
          apartment: a.apartment,
          landmark: a.landmark,
          lat: a.lat,
          lng: a.lng,
          isDefault: a.isDefault,
        }),
      )
    : [];
  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 pb-16 sm:px-6 md:pt-12 lg:px-8">
      <h1 className="mb-7 text-4xl md:text-5xl">{t("title")}</h1>
      <CheckoutForm profile={session ? { name: session.fullName, phone: session.phone } : null} savedAddresses={addresses} />
    </div>
  );
}

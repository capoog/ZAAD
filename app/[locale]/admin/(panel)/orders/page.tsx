import { getTranslations, setRequestLocale } from "next-intl/server";
import { OrdersBoard } from "@/components/admin/orders-board";
import { requireStaffPage } from "@/server/auth/guard";
import { getBoard } from "@/server/services/admin";

export default async function AdminOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ forbidden?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireStaffPage(locale);
  const { forbidden } = await searchParams;
  const t = await getTranslations("admin");
  const data = await getBoard(session);
  return (
    <>
      {forbidden && <p className="mb-4 rounded-xl border border-chili-400/30 bg-chili-900/50 p-3 text-sm text-chili-400">{t("forbidden")}</p>}
      <OrdersBoard initial={data} roles={session.roles} userId={session.userId} />
    </>
  );
}

import { getTranslations, setRequestLocale } from "next-intl/server";
import { StaffManager } from "@/components/admin/staff-manager";
import { requireStaffPage } from "@/server/auth/guard";
import { listStaff } from "@/server/services/admin";

export default async function StaffPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireStaffPage(locale, ["owner"]);
  const t = await getTranslations("admin.staff");
  const members = await listStaff();
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-3xl md:text-4xl">{t("title")}</h1>
      <StaffManager members={members} meId={session.userId} />
    </div>
  );
}

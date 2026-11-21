"use client";

import { useTransition } from "react";
import { LogOut, Star, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { deleteAddressAction, makeDefaultAddressAction } from "@/server/actions/account";
import { logoutAction } from "@/server/actions/auth";

export function LogoutButton() {
  const t = useTranslations("account");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await logoutAction();
          router.refresh();
        })
      }
    >
      <LogOut aria-hidden />
      {t("logout")}
    </Button>
  );
}

export function AddressButtons({ id, isDefault }: { id: string; isDefault: boolean }) {
  const t = useTranslations("account");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-1">
      {!isDefault && (
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(async () => void ((await makeDefaultAddressAction(id)) && router.refresh()))}>
          <Star aria-hidden />
          {t("makeDefault")}
        </Button>
      )}
      <Button variant="ghost" size="sm" className="text-chili-400" disabled={pending} onClick={() => start(async () => void ((await deleteAddressAction(id)) && router.refresh()))}>
        <Trash2 aria-hidden />
        {t("deleteAddress")}
      </Button>
    </div>
  );
}

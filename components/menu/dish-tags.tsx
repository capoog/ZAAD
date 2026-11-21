import { Flame, Leaf, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

export function DishTags({
  spicy,
  vegetarian,
  bestSeller,
  glass = false,
}: {
  spicy?: boolean;
  vegetarian?: boolean;
  bestSeller?: boolean;
  glass?: boolean;
}) {
  const t = useTranslations("tags");
  return (
    <>
      {bestSeller && (
        <Badge variant={glass ? "glass" : "flame"}>
          <Star className="fill-flame-400 text-flame-400" aria-hidden />
          {t("bestSeller")}
        </Badge>
      )}
      {spicy && (
        <Badge variant={glass ? "glass" : "chili"}>
          <Flame className="text-chili-400" aria-hidden />
          {t("spicy")}
        </Badge>
      )}
      {vegetarian && (
        <Badge variant={glass ? "glass" : "zaatar"}>
          <Leaf className="text-zaatar-400" aria-hidden />
          {t("vegetarian")}
        </Badge>
      )}
    </>
  );
}

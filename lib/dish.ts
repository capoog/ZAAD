import type { DishCardData } from "@/components/menu/dish-card";
import type { MenuItem } from "@/types/catalog";

export function minPrice(item: Pick<MenuItem, "sizes" | "basePricePiasters">): number {
  return item.sizes.length ? Math.min(...item.sizes.map((s) => s.pricePiasters)) : item.basePricePiasters;
}

export function toDishCard(item: MenuItem, locale: "ar" | "en"): DishCardData {
  return {
    slug: item.slug,
    name: locale === "ar" ? item.nameAr : item.nameEn,
    description: (locale === "ar" ? item.descriptionAr : item.descriptionEn) ?? "",
    pricePiasters: minPrice(item),
    hasSizes: item.sizes.length > 1,
    imageUrl: item.imageUrl,
    category: item.categorySlug,
    isSpicy: item.isSpicy,
    isVegetarian: item.isVegetarian,
    isBestSeller: item.isBestSeller,
    isSoldOut: item.isSoldOut,
  };
}

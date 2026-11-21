/** Serializable catalogue types shared by server and client. */
export interface MenuAddon {
  id: string;
  nameAr: string;
  nameEn: string;
  pricePiasters: number;
  isAvailable: boolean;
}

export interface MenuAddonGroup {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  minSelect: number;
  maxSelect: number | null;
  addons: MenuAddon[];
}

export interface MenuSize {
  id: string;
  nameAr: string;
  nameEn: string;
  pricePiasters: number;
  isDefault: boolean;
}

export interface MenuItem {
  id: string;
  slug: string;
  categoryId: string;
  categorySlug: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  basePricePiasters: number;
  imageUrl: string | null;
  isSpicy: boolean;
  isVegetarian: boolean;
  isBestSeller: boolean;
  isFeatured: boolean;
  isSoldOut: boolean;
  isActive: boolean;
  sizes: MenuSize[];
  addonGroups: MenuAddonGroup[];
}

export interface MenuCategory {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  imageUrl: string | null;
  items: MenuItem[];
}

export interface Zone {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  feePiasters: number;
  minOrderPiasters: number;
  etaMinMinutes: number;
  etaMaxMinutes: number;
}

export interface Offer {
  id: string;
  titleAr: string;
  titleEn: string;
  subtitleAr: string | null;
  subtitleEn: string | null;
  badgeAr: string | null;
  badgeEn: string | null;
  imageUrl: string | null;
  menuItemSlug: string | null;
  promoCode: string | null;
}

export interface Review {
  id: string;
  customerName: string;
  rating: number;
  comment: string | null;
  locale: "ar" | "en";
  createdAt: string;
}

export interface RestaurantInfo {
  nameAr: string;
  nameEn: string;
  phone: string;
  whatsapp: string;
  addressAr: string;
  addressEn: string;
  lat: number;
  lng: number;
  instagram?: string;
}

export interface VatSettings {
  rateBps: number;
  pricesIncludeVat: boolean;
}

export interface OrderingSettings {
  acceptingOrders: boolean;
  allowScheduledWhenClosed: boolean;
  minScheduleLeadMinutes: number;
  maxScheduleDays: number;
  pickupEtaMinutes: number;
}

export interface PaymentToggles {
  cash: boolean;
  card: boolean;
  wallet: boolean;
  fawry: boolean;
  valu: boolean;
  instapay: boolean;
}

export interface InstapaySettings {
  enabled: boolean;
  handle: string;
  accountName: string;
}

export interface OpeningHour {
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
}

export interface PublicSettings {
  restaurant: RestaurantInfo;
  vat: VatSettings;
  ordering: OrderingSettings;
  payments: PaymentToggles;
  instapay: InstapaySettings;
  hours: OpeningHour[];
}

export const pick = <T,>(locale: string, ar: T, en: T): T => (locale === "ar" ? ar : en);

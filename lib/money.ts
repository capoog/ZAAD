/** All money is integer piasters (1 EGP = 100 piasters). */
export type Piasters = number;

export const egp = (pounds: number): Piasters => Math.round(pounds * 100);

export type AppLocale = "ar" | "en";

const formatters = new Map<string, Intl.NumberFormat>();
function numberFormat(locale: AppLocale, fractionDigits: number): Intl.NumberFormat {
  const key = `${locale}:${fractionDigits}`;
  let f = formatters.get(key);
  if (!f) {
    // Latin digits in both languages: Egyptian menus, receipts and phone
    // numbers overwhelmingly use them, and they stay legible at small sizes.
    f = new Intl.NumberFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-EG", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    formatters.set(key, f);
  }
  return f;
}

/** 22000 → "220 ج.م" (ar) / "EGP 220" (en). Shows decimals only when needed. */
export function formatMoney(piasters: Piasters, locale: AppLocale): string {
  const negative = piasters < 0;
  const abs = Math.abs(piasters);
  const digits = abs % 100 === 0 ? 0 : 2;
  const n = numberFormat(locale, digits).format(abs / 100);
  const signed = negative ? `-${n}` : n;
  return locale === "ar" ? `${signed} ج.م` : `EGP ${signed}`;
}

/** Number only, e.g. for compact price chips. */
export function formatAmount(piasters: Piasters, locale: AppLocale): string {
  const digits = piasters % 100 === 0 ? 0 : 2;
  return numberFormat(locale, digits).format(piasters / 100);
}

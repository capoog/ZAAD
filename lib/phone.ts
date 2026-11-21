/**
 * Egyptian mobile numbers: 01[0125] + 8 digits
 * (010 Vodafone, 011 Etisalat/e&, 012 Orange, 015 WE).
 */
export const EG_MOBILE_REGEX = /^01[0125]\d{8}$/;

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN = "۰۱۲۳۴۵۶۷۸۹";

/** Accepts "+20 100 000 0000", "0020100…", "٠١٠٠…" etc. and returns "0100…" or the cleaned input. */
export function normalizeEgyptianPhone(input: string): string {
  let s = "";
  for (const ch of input.trim()) {
    const a = ARABIC_INDIC.indexOf(ch);
    const p = PERSIAN.indexOf(ch);
    if (a >= 0) s += String(a);
    else if (p >= 0) s += String(p);
    else if (/[0-9+]/.test(ch)) s += ch;
    // spaces, dashes, brackets and dots are dropped
  }
  if (s.startsWith("+20")) s = "0" + s.slice(3);
  else if (s.startsWith("0020")) s = "0" + s.slice(4);
  else if (s.startsWith("20") && s.length === 12) s = "0" + s.slice(2);
  return s;
}

export function isValidEgyptianMobile(input: string): boolean {
  return EG_MOBILE_REGEX.test(normalizeEgyptianPhone(input));
}

/** "01001234567" → "+201001234567" (E.164, for SMS/WhatsApp providers). */
export function toE164(phone: string): string {
  const n = normalizeEgyptianPhone(phone);
  return `+2${n}`;
}

/** "01001234567" → "0100 123 4567" for display. */
export function formatPhone(phone: string): string {
  const n = normalizeEgyptianPhone(phone);
  if (!EG_MOBILE_REGEX.test(n)) return phone;
  return `${n.slice(0, 4)} ${n.slice(4, 7)} ${n.slice(7)}`;
}

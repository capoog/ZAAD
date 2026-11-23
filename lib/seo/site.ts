export const SITE_URL = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

/** hreflang alternates + canonical for a path that exists in both languages. */
export function alternatesFor(path: string, locale: string) {
  const clean = path === "/" ? "" : path;
  return {
    canonical: `${SITE_URL}${locale === "en" ? "/en" : ""}${clean}` || "/",
    languages: { ar: `${SITE_URL}${clean || "/"}`, en: `${SITE_URL}/en${clean}`, "x-default": `${SITE_URL}${clean || "/"}` },
  };
}

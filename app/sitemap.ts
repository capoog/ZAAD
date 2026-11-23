import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/site";
import { getMenu } from "@/server/services/catalog";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const menu = await getMenu().catch(() => []);
  const paths = ["", "/menu", ...menu.flatMap((c) => c.items.map((i) => `/menu/${i.slug}`))];
  const now = new Date();
  return paths.map((p) => ({
    url: `${SITE_URL}${p || "/"}`,
    lastModified: now,
    changeFrequency: p === "" || p === "/menu" ? "daily" : "weekly",
    priority: p === "" ? 1 : p === "/menu" ? 0.9 : 0.7,
    alternates: { languages: { ar: `${SITE_URL}${p || "/"}`, en: `${SITE_URL}/en${p}` } },
  }));
}

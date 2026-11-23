import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/en/admin", "/cart", "/en/cart", "/checkout", "/en/checkout", "/orders", "/en/orders", "/pay", "/en/pay", "/api", "/style-guide", "/en/style-guide"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

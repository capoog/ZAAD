import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "فحم وزعتر — Fahm & Zaatar",
    short_name: "فحم وزعتر",
    description: "اطلب مشويات على الفحم، شاورما شامي وفطائر طازة — التجمع الخامس",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    dir: "rtl",
    lang: "ar",
    background_color: "#12100e",
    theme_color: "#12100e",
    categories: ["food", "shopping"],
    icons: [
      { src: "/brand/app-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/app-icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/app-icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "المنيو", short_name: "المنيو", url: "/menu", icons: [{ src: "/brand/app-icon-192.png", sizes: "192x192" }] },
      { name: "أوردراتي", short_name: "أوردراتي", url: "/orders", icons: [{ src: "/brand/app-icon-192.png", sizes: "192x192" }] },
    ],
  };
}

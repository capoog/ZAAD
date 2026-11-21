import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["ar", "en"],
  defaultLocale: "ar",
  // Arabic lives at "/", English at "/en".
  localePrefix: "as-needed",
  // The audience is Egyptian: always start in Arabic, whatever the browser says.
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];

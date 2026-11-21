import { IBM_Plex_Sans_Arabic, Reem_Kufi } from "next/font/google";

/** UI & body: covers Arabic + Latin with matching proportions. */
export const plex = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
  preload: true,
});

/** Display: a Kufic face for headlines and the brand — signage, not body copy. */
export const kufi = Reem_Kufi({
  subsets: ["arabic", "latin"],
  weight: ["500", "600", "700"],
  variable: "--font-kufi",
  display: "swap",
  preload: true,
});

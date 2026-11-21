import { Clock, ExternalLink, MapPin, Navigation, Phone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { OpenStatus } from "@/components/common/open-status";
import { formatClock, fromCairoWallClock, toCairoWallClock } from "@/lib/hours";
import { formatMoney } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import type { PublicSettings, Zone } from "@/types/catalog";
import { SectionHeading } from "./section-heading";

/** Lightweight stylised map (no third-party tiles → fast, private, never broken). */
function StylisedMap({ label }: { label: string }) {
  const blocks: [number, number, number, number][] = [
    [20, 30, 120, 70],
    [160, 24, 90, 60],
    [270, 30, 140, 84],
    [430, 20, 120, 64],
    [570, 36, 110, 90],
    [24, 130, 90, 110],
    [140, 120, 130, 80],
    [300, 150, 100, 60],
    [440, 110, 100, 110],
    [560, 150, 130, 70],
    [30, 270, 140, 60],
    [200, 230, 90, 100],
    [320, 240, 130, 80],
    [480, 250, 90, 70],
    [590, 250, 100, 90],
  ];
  return (
    <svg
      viewBox="0 0 700 360"
      role="img"
      aria-label={label}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="700" height="360" fill="#17130f" />
      {blocks.map(([x, y, w, h], i) => (
        <rect
          key={i}
          x={x}
          y={y}
          width={w}
          height={h}
          rx="10"
          fill={i % 5 === 2 ? "#1d2414" : "#211c17"}
        />
      ))}
      <path
        d="M-10 212 C 150 200, 260 214, 420 206 S 640 196, 720 204"
        stroke="#3a322b"
        strokeWidth="18"
        fill="none"
      />
      <path
        d="M-10 212 C 150 200, 260 214, 420 206 S 640 196, 720 204"
        stroke="#ff8a45"
        strokeOpacity="0.35"
        strokeWidth="2"
        strokeDasharray="10 12"
        fill="none"
      />
      <path
        d="M352 -10 C 340 90, 368 160, 350 370"
        stroke="#2e2722"
        strokeWidth="12"
        fill="none"
      />
      <path
        d="M120 -10 L 160 370 M 560 -10 L 520 370"
        stroke="#2a241f"
        strokeWidth="8"
      />
      <circle cx="350" cy="190" r="70" fill="url(#pinGlow)" />
      <defs>
        <radialGradient id="pinGlow">
          <stop offset="0" stopColor="#ff8a45" stopOpacity="0.45" />
          <stop offset="1" stopColor="#ff8a45" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g transform="translate(350 190)">
        <circle r="16" fill="#ff8a45" opacity="0.25">
          <animate
            attributeName="r"
            values="12;30;12"
            dur="2.4s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.35;0;0.35"
            dur="2.4s"
            repeatCount="indefinite"
          />
        </circle>
        <path
          d="M0 -38 C 14 -38 24 -28 24 -15 C 24 2 0 22 0 22 C 0 22 -24 2 -24 -15 C -24 -28 -14 -38 0 -38 Z"
          fill="#ff8a45"
        />
        <circle cy="-15" r="8" fill="#12100e" />
      </g>
    </svg>
  );
}

export async function Location({
  settings,
  zones,
  locale,
}: {
  settings: PublicSettings;
  zones: Zone[];
  locale: "ar" | "en";
}) {
  const t = await getTranslations("home");
  const tc = await getTranslations("common");
  const r = settings.restaurant;
  const maps = `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`;
  const today = toCairoWallClock(new Date());
  const hours = settings.hours[0];
  const sample = (hhmm: string) => {
    const [h = 0, m = 0] = hhmm.split(":").map(Number);
    return formatClock(
      fromCairoWallClock(today.year, today.month, today.day, h, m),
      locale,
    );
  };
  const allSame = settings.hours.every(
    (h) =>
      h.opensAt === hours?.opensAt &&
      h.closesAt === hours?.closesAt &&
      !h.isClosed,
  );

  return (
    <section
      id="location"
      aria-labelledby="loc"
      className="mx-auto max-w-7xl scroll-mt-24 px-4 pt-20 sm:px-6 lg:px-8"
    >
      <SectionHeading
        id="loc"
        title={t("locationTitle")}
        subtitle={t("locationSubtitle")}
      />
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="relative min-h-72 overflow-hidden rounded-2xl border border-border shadow-card">
          <StylisedMap label={locale === "ar" ? r.addressAr : r.addressEn} />
          <div className="absolute inset-x-3 bottom-3 flex flex-col gap-3 rounded-xl border border-border-strong bg-coal-900/85 p-4 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <MapPin className="size-5 shrink-0 text-ember-400" aria-hidden />
              <div className="text-sm">
                <p className="font-semibold">
                  {locale === "ar" ? r.nameAr : r.nameEn}
                </p>
                <p className="text-smoke-300">
                  {locale === "ar" ? r.addressAr : r.addressEn}
                </p>
              </div>
            </div>
            <Button size="sm" asChild>
              <a href={maps} target="_blank" rel="noopener noreferrer">
                <Navigation aria-hidden />
                {t("openInMaps")}
                <ExternalLink className="size-3.5 opacity-70" aria-hidden />
              </a>
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 font-sans text-base font-semibold">
                <Clock className="size-4 text-ember-400" aria-hidden />
                {t("hoursTitle")}
              </h3>
              <OpenStatus
                rows={settings.hours}
                locale={locale}
                className="text-xs"
              />
            </div>
            {allSame && hours ? (
              <p className="flex items-center justify-between text-sm">
                <span className="text-smoke-300">{t("everyDay")}</span>
                <span className="tabular font-semibold">
                  <bdi>{sample(hours.opensAt)}</bdi> –{" "}
                  <bdi>{sample(hours.closesAt)}</bdi>
                </span>
              </p>
            ) : null}
            <a
              href={`tel:${r.phone}`}
              className="mt-3 flex items-center gap-2 text-sm text-smoke-200 hover:text-ember-300"
            >
              <Phone className="size-4 text-ember-400" aria-hidden />
              <span dir="ltr" className="tabular">
                {formatPhone(r.phone)}
              </span>
            </a>
          </div>
          <div className="flex-1 rounded-2xl border border-border bg-card p-5 shadow-card">
            <h3 className="mb-3 font-sans text-base font-semibold">
              {t("zonesTitle")}
            </h3>
            <ul className="divide-y divide-border">
              {zones.map((z) => (
                <li
                  key={z.id}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {locale === "ar" ? z.nameAr : z.nameEn}
                    </p>
                    <p className="text-xs text-smoke-400">
                      {t("minOrder", {
                        amount: formatMoney(z.minOrderPiasters, locale),
                      })}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end">
                    <span className="tabular font-semibold">
                      {formatMoney(z.feePiasters, locale)}
                    </span>
                    <span className="tabular text-xs text-smoke-400">
                      {tc("etaRange", {
                        min: z.etaMinMinutes,
                        max: z.etaMaxMinutes,
                      })}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

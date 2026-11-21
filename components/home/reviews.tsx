import { Quote, Star } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { Review } from "@/types/catalog";
import { SectionHeading } from "./section-heading";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5" role="img" aria-label={`${rating}/5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} aria-hidden className={`size-4 ${n <= rating ? "fill-flame-400 text-flame-400" : "text-coal-600"}`} />
      ))}
    </span>
  );
}

export async function Reviews({ data }: { data: { reviews: Review[]; average: number; count: number } }) {
  if (!data.count) return null;
  const t = await getTranslations("home");
  return (
    <section aria-labelledby="reviews" className="mx-auto max-w-7xl px-4 pt-20 sm:px-6 lg:px-8">
      <SectionHeading
        id="reviews"
        title={t("reviewsTitle")}
        action={
          <span className="flex items-center gap-2 rounded-full border border-flame-400/30 bg-flame-400/10 px-3 py-1.5 text-sm font-semibold text-flame-300">
            <Star className="size-4 fill-flame-400 text-flame-400" aria-hidden />
            {t("reviewsSummary", { avg: data.average.toFixed(1), count: data.count })}
          </span>
        }
      />
      <ul className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:px-0">
        {data.reviews.slice(0, 6).map((r) => (
          <li key={r.id} className="w-[80vw] max-w-sm shrink-0 snap-start md:w-auto md:max-w-none">
            <figure className="flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-center justify-between">
                <Stars rating={r.rating} />
                <Quote className="size-5 text-ember-400/50" aria-hidden />
              </div>
              <blockquote lang={r.locale} dir={r.locale === "ar" ? "rtl" : "ltr"} className="flex-1 text-[0.95rem] leading-relaxed text-smoke-200">
                {r.comment}
              </blockquote>
              <figcaption className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-full bg-coal-700 font-display text-ember-300">
                  {r.customerName.trim().charAt(0)}
                </span>
                <span className="text-sm font-semibold">{r.customerName}</span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}

import { Flame, Leaf, Timer } from "lucide-react";
import { getTranslations } from "next-intl/server";

export async function Why() {
  const t = await getTranslations("home");
  const items = [
    { icon: Flame, title: t("why1Title"), body: t("why1Body") },
    { icon: Timer, title: t("why2Title"), body: t("why2Body") },
    { icon: Leaf, title: t("why3Title"), body: t("why3Body") },
  ];
  return (
    <section aria-labelledby="why" className="mx-auto max-w-7xl px-4 pt-20 sm:px-6 lg:px-8">
      <div className="grain relative overflow-hidden rounded-3xl border border-border bg-[radial-gradient(80%_120%_at_100%_0%,rgb(255_138_69/0.14),transparent_60%),var(--color-coal-850)] p-6 md:p-10">
        <h2 id="why" className="mb-8 text-3xl md:text-4xl">
          {t("whyTitle")}
        </h2>
        <ul className="grid gap-6 md:grid-cols-3 md:gap-8">
          {items.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-4 md:flex-col">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-ember-400/12 text-ember-400 ring-1 ring-ember-400/25">
                <Icon className="size-6" aria-hidden />
              </span>
              <div>
                <h3 className="font-sans text-lg font-semibold">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-smoke-300">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

export default function MenuLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8" aria-busy="true">
      <Skeleton className="h-11 w-40" />
      <Skeleton className="mt-3 h-5 w-72" />
      <Skeleton className="mt-8 h-12 w-full rounded-full md:max-w-md" />
      <div className="mt-6 flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-24 rounded-full" />
        ))}
      </div>
      <div className="mt-10 flex flex-col gap-3 md:grid md:grid-cols-3 md:gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-3 rounded-2xl border border-border p-2.5 md:flex-col">
            <Skeleton className="size-28 shrink-0 rounded-xl md:aspect-[4/3] md:size-auto md:w-full" />
            <div className="flex flex-1 flex-col gap-2 py-1">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="mt-auto h-6 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

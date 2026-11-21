"use client";

import Image from "next/image";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const FALLBACKS = new Set(["grills", "shawarma", "pies", "appetizers", "desserts", "drinks"]);

export function fallbackArt(category?: string | null): string {
  return category && FALLBACKS.has(category) ? `/art/fallback-${category}.svg` : "/art/fallback-dish.svg";
}

/**
 * Food photo with a guaranteed graceful fallback: if the remote photo fails
 * (offline, blocked CDN, deleted upload) a designed illustration is shown
 * instead, so the site never renders a broken image.
 */
export function FoodImage({
  src,
  alt,
  category,
  sizes,
  priority = false,
  className,
  imgClassName,
}: {
  src: string | null | undefined;
  alt: string;
  category?: string | null;
  sizes: string;
  priority?: boolean;
  className?: string;
  imgClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const effective = !src || failed ? fallbackArt(category) : src;
  const isLocalSvg = effective.endsWith(".svg");

  return (
    <div className={cn("relative overflow-hidden bg-coal-800", className)}>
      {!loaded && !isLocalSvg && <Skeleton className="absolute inset-0 rounded-none" />}
      <Image
        src={effective}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        unoptimized={isLocalSvg}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={cn(
          "object-cover transition-[opacity,transform] duration-500 ease-out",
          loaded || isLocalSvg ? "opacity-100" : "opacity-0",
          imgClassName,
        )}
      />
    </div>
  );
}

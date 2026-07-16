import { useState } from "react";
import { resolveApiUrl } from "../lib/api";

/**
 * Image with a warm placeholder fallback when the photo fails to load.
 *
 * `fit="contain"` shows the WHOLE product (no cropping) and letterboxes any
 * empty space against a neutral background — use it for menu/product photos so
 * the full drink, cup, plate or sandwich is always visible. `fit="cover"`
 * (the default) fills the frame and is right for decorative/banner imagery.
 */
export function Img({
  src,
  alt,
  className,
  fit = "cover",
  position,
}: {
  src: string | null;
  alt: string;
  className?: string;
  fit?: "cover" | "contain";
  /** CSS object-position, e.g. "50% 30%" — which part of the photo stays when cropped. */
  position?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div role="img" aria-label={alt} className={`bg-oat flex items-center justify-center ${className ?? ""}`}>
        <img src="/bean.png" alt="" className="h-1/3 max-h-16 opacity-60" />
      </div>
    );
  }
  return (
    <img
      src={resolveApiUrl(src)}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      style={position ? { objectPosition: position } : undefined}
      className={`${fit === "contain" ? "object-contain" : "object-cover"} ${className ?? ""}`}
    />
  );
}

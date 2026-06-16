import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { Banner } from "../types";

export function HomeBanner() {
  const [banner, setBanner] = useState<Banner | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    api.get<Banner | null>("/api/banners/active").then(setBanner).catch(() => {});
  }, []);

  if (!banner || dismissed) return null;

  const isExternal = banner.buttonLink?.startsWith("http");

  return (
    <div className="bg-mocha text-cream">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
        {banner.image && (
          <img
            src={banner.image}
            alt=""
            className="hidden h-12 w-12 rounded-lg object-cover sm:block"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold">{banner.title}</p>
          {banner.text && <p className="text-sm text-oat">{banner.text}</p>}
        </div>
        {banner.buttonText && banner.buttonLink && (
          isExternal ? (
            <a
              href={banner.buttonLink}
              target="_blank"
              rel="noreferrer"
              className="btn-3d shrink-0 rounded-full bg-terracotta px-5 py-2 text-sm font-semibold text-cream"
            >
              {banner.buttonText}
            </a>
          ) : (
            <Link
              to={banner.buttonLink}
              className="btn-3d shrink-0 rounded-full bg-terracotta px-5 py-2 text-sm font-semibold text-cream"
            >
              {banner.buttonText}
            </Link>
          )
        )}
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss announcement"
          className="shrink-0 rounded-full px-2 text-lg text-oat/70 hover:text-cream"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

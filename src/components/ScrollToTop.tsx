import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

// Take scroll positioning into our own hands. The browser's automatic
// restoration drops the user at a stale offset after a PWA relaunch and fights
// our own logic — we replace it with an explicit, predictable scheme below.
if (typeof history !== "undefined" && "scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

// Remembered scroll offset per history entry (keyed by React Router's location
// key), so Back/Forward can return the reader to exactly where they were.
const positions = new Map<string, number>();

// Scroll to `y`, retrying for ~1s so a restore still lands correctly even when
// the page is still short and grows as menu/shop/doughnut data loads in.
function scrollToY(y: number) {
  if (y <= 0) {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    return;
  }
  let frames = 0;
  const go = () => {
    window.scrollTo({ top: y, left: 0, behavior: "instant" as ScrollBehavior });
    if (window.scrollY < y - 2 && frames++ < 60) requestAnimationFrame(go);
  };
  requestAnimationFrame(go);
}

/**
 * Global scroll behaviour on navigation:
 *   • #section        → scroll to that element once it renders (sticky-header
 *                       gap comes from `scroll-padding-top` in index.css).
 *   • Back / Forward  → restore the offset the reader left this entry at.
 *   • New page (push) → jump to the top, instantly.
 *   • Query-only change on the SAME page (e.g. /account?tab=orders) → stay put.
 */
export function ScrollToTop() {
  const location = useLocation();
  const navType = useNavigationType();
  const prev = useRef<{ pathname: string; hash: string } | null>(null);

  // Continuously record where we are on the current history entry.
  useEffect(() => {
    const key = location.key;
    const onScroll = () => positions.set(key, window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [location.key]);

  useLayoutEffect(() => {
    const { pathname, hash, key } = location;

    if (hash) {
      const id = decodeURIComponent(hash.slice(1));
      let frames = 0;
      const go = () => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        else if (frames++ < 60) requestAnimationFrame(go);
      };
      requestAnimationFrame(go);
    } else if (navType === "POP") {
      scrollToY(positions.get(key) ?? 0);
    } else {
      // push / replace: only reset to top when the page actually changed, so a
      // query-string tab or filter switch doesn't yank the reader around.
      const samePage = prev.current?.pathname === pathname && prev.current?.hash === hash;
      if (!samePage) scrollToY(0);
    }

    prev.current = { pathname, hash };
  }, [location, navType]);

  return null;
}

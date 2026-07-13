import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Take scroll positioning into our own hands. The browser's automatic
// restoration drops the user at a stale offset after back/forward and when a
// PWA relaunches — the source of "the page opens halfway down".
if (typeof history !== "undefined" && "scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

/**
 * Global scroll behaviour for route changes:
 *   • no hash  → jump to the top of the new page, instantly (no smooth slide).
 *   • #section → scroll to that element once it exists in the DOM, leaving room
 *     for the sticky header (handled by `scroll-padding-top` in index.css).
 *
 * Keyed on pathname + hash only, so switching a query-string tab/filter on the
 * SAME page (e.g. /account?tab=orders) keeps the reader where they are.
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const id = decodeURIComponent(hash.slice(1));
      let frames = 0;
      // Dynamic pages (menu, shop, doughnuts…) render their sections after data
      // loads — poll a few frames until the target appears, then stop.
      const findAndScroll = () => {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        } else if (frames++ < 60) {
          requestAnimationFrame(findAndScroll);
        }
      };
      requestAnimationFrame(findAndScroll);
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname, hash]);

  return null;
}

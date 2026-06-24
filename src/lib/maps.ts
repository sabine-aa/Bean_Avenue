// Lazy loader for the Google Maps JavaScript API. The key comes from
// VITE_GOOGLE_MAPS_API_KEY (see Bean_Avenue/.env). When no key is configured
// the picker degrades gracefully to manual address entry.

export const GOOGLE_MAPS_KEY: string = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "";
export const hasMapsKey = () => GOOGLE_MAPS_KEY.length > 0;

let loadPromise: Promise<typeof google.maps> | null = null;

export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (!hasMapsKey()) return Promise.reject(new Error("No Google Maps API key configured."));
  if (typeof window !== "undefined" && window.google?.maps) return Promise.resolve(window.google.maps);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById("google-maps-script") as HTMLScriptElement | null;
    const onReady = () => (window.google?.maps ? resolve(window.google.maps) : reject(new Error("Maps failed to load.")));
    if (existing) {
      existing.addEventListener("load", onReady);
      existing.addEventListener("error", () => reject(new Error("Maps failed to load.")));
      return;
    }
    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = onReady;
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Maps failed to load."));
    };
    document.head.appendChild(script);
  });
  return loadPromise;
}

/** Build a Google Maps link from coordinates (works without an API key). */
export const mapsLinkFromCoords = (lat: number, lng: number) =>
  `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

/** Build a Google Maps search link from a free-text address. */
export const mapsLinkFromText = (text: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`;

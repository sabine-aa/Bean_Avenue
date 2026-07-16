import { useEffect, useRef, useState } from "react";
import { hasMapsKey, loadGoogleMaps } from "../lib/maps";

interface MapPickerProps {
  lat: number | null;
  lng: number | null;
  onChange: (coords: { lat: number; lng: number }) => void;
}

// Default map centre — Bean Avenue's home town, Aley, Lebanon. Used only until
// the customer drops a pin or taps "Use my location".
const DEFAULT_CENTER = { lat: 33.8056, lng: 35.6011 };

/**
 * A Google Maps pin picker. Click or drag the marker to set the delivery
 * location; "Use my location" centres on the device's GPS. Falls back to manual
 * lat/lng entry when no API key is configured or the map fails to load.
 */
export function MapPicker({ lat, lng, onChange }: MapPickerProps) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">(hasMapsKey() ? "loading" : "unavailable");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!hasMapsKey()) return;
    let cancelled = false;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !mapEl.current) return;
        const center = lat != null && lng != null ? { lat, lng } : DEFAULT_CENTER;
        const map = new maps.Map(mapEl.current, {
          center,
          zoom: lat != null ? 16 : 12,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
        });
        const marker = new maps.Marker({ position: center, map, draggable: true });
        mapRef.current = map;
        markerRef.current = marker;
        const set = (pos: any) => {
          const next = { lat: pos.lat(), lng: pos.lng() };
          marker.setPosition(next);
          onChangeRef.current(next);
        };
        marker.addListener("dragend", (e: any) => set(e.latLng));
        map.addListener("click", (e: any) => set(e.latLng));
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("unavailable"));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the marker in sync when the parent sets coords (e.g. picking a saved address).
  useEffect(() => {
    if (status === "ready" && markerRef.current && mapRef.current && lat != null && lng != null) {
      const pos = { lat, lng };
      markerRef.current.setPosition(pos);
      mapRef.current.panTo(pos);
    }
  }, [lat, lng, status]);

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => onChangeRef.current({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  if (status === "unavailable") {
    return (
      <div className="border-oat bg-oat/30 rounded-xl border border-dashed p-4 text-sm">
        <p className="text-espresso font-semibold">📍 Pin your location (optional)</p>
        <p className="text-charcoal/60 mt-1 text-xs">
          Map picker isn't available right now. You can paste coordinates from Google Maps, or just fill in the address fields — staff will still get a maps
          link.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input
            inputMode="decimal"
            placeholder="Latitude"
            value={lat ?? ""}
            onChange={(e) => onChange({ lat: Number(e.target.value), lng: lng ?? 0 })}
            className="border-oat rounded-lg border px-3 py-2 text-sm"
          />
          <input
            inputMode="decimal"
            placeholder="Longitude"
            value={lng ?? ""}
            onChange={(e) => onChange({ lat: lat ?? 0, lng: Number(e.target.value) })}
            className="border-oat rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        <button type="button" onClick={useMyLocation} className="text-terracotta mt-2 text-xs font-semibold hover:underline">
          Use my current location
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-espresso text-sm font-semibold">📍 Pin your exact location</p>
        <button type="button" onClick={useMyLocation} className="text-terracotta text-xs font-semibold hover:underline">
          Use my location
        </button>
      </div>
      <div ref={mapEl} className="border-oat bg-oat/40 mt-2 h-52 w-full overflow-hidden rounded-xl border" />
      {status === "loading" && <p className="text-charcoal/50 mt-1 text-xs">Loading map…</p>}
      {lat != null && lng != null && (
        <p className="text-charcoal/50 mt-1 text-xs">
          Pinned at {lat.toFixed(5)}, {lng.toFixed(5)} — drag the marker to fine-tune.
        </p>
      )}
    </div>
  );
}

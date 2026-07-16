import type { DeliveryZone } from "@prisma/client";
import { prisma } from "../db";
import { round2 } from "./helpers";
import { storefrontConfig, type StorefrontConfig } from "./settings";

/** Great-circle distance between two lat/lng points, in kilometres. */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

const norm = (s: string) => s.trim().toLowerCase();

export interface AddressLike {
  area?: string | null;
  lat?: number | null;
  lng?: number | null;
}

/**
 * Find the delivery zone that serves an address. Prefers a location-based match
 * (within a zone's maxDistanceKm of its centre) and falls back to matching the
 * typed area name against the zone name. Returns null when nothing covers it.
 */
export function pickZone(zones: DeliveryZone[], addr: AddressLike): DeliveryZone | null {
  const available = zones.filter((z) => z.isAvailable);

  // 1) Location-based: closest zone whose radius contains the pin.
  if (addr.lat != null && addr.lng != null) {
    let best: { zone: DeliveryZone; dist: number } | null = null;
    for (const z of available) {
      if (z.maxDistanceKm != null && z.centerLat != null && z.centerLng != null) {
        const dist = haversineKm(addr.lat, addr.lng, z.centerLat, z.centerLng);
        if (dist <= z.maxDistanceKm && (!best || dist < best.dist)) best = { zone: z, dist };
      }
    }
    if (best) return best.zone;
  }

  // 2) Name/area match.
  const area = norm(addr.area ?? "");
  if (area) {
    const exact = available.find((z) => norm(z.name) === area);
    if (exact) return exact;
    const partial = available.find((z) => norm(z.name).includes(area) || area.includes(norm(z.name)));
    if (partial) return partial;
  }
  return null;
}

export interface DeliveryQuote {
  available: boolean;
  reason?: string;
  zone?: { id: number; name: string; estimatedTime: string };
  fee: number;
  minOrder: number;
  belowMinimum: boolean;
  freeApplied: boolean;
}

const UNAVAILABLE_MSG = "Delivery is not currently available to this location. You can still place the order for pickup.";

/**
 * The authoritative delivery quote: availability, matched zone, fee (after the
 * free-delivery threshold), and minimum-order check. Used by the public quote
 * endpoint AND by order creation, so the two can never disagree.
 */
export async function quoteDelivery(addr: AddressLike, subtotal: number, cfg?: StorefrontConfig): Promise<DeliveryQuote> {
  const config = cfg ?? (await storefrontConfig());
  const base: DeliveryQuote = { available: false, fee: 0, minOrder: 0, belowMinimum: false, freeApplied: false };

  if (!config.delivery.enabled) return { ...base, reason: "Delivery is currently turned off. You can still order for pickup." };
  if (config.delivery.paused) return { ...base, reason: "Delivery is paused right now because we're busy. You can still order for pickup." };
  if (!config.delivery.hoursOpen)
    return {
      ...base,
      reason: `Delivery is outside operating hours (${config.delivery.hours.start}–${config.delivery.hours.end}). You can still order for pickup.`,
    };

  const zones = await prisma.deliveryZone.findMany({ orderBy: { sortOrder: "asc" } });
  const zone = pickZone(zones, addr);
  if (!zone) return { ...base, reason: UNAVAILABLE_MSG };

  const freeThreshold = config.delivery.freeThreshold;
  const freeApplied = freeThreshold > 0 && subtotal >= freeThreshold;
  const fee = freeApplied ? 0 : round2(zone.fee);
  const belowMinimum = subtotal < zone.minOrder;

  return {
    available: true,
    zone: { id: zone.id, name: zone.name, estimatedTime: zone.estimatedTime || config.delivery.defaultEstimate },
    fee,
    minOrder: round2(zone.minOrder),
    belowMinimum,
    freeApplied,
  };
}

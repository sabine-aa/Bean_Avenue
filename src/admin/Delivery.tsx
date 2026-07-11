import { useEffect, useState } from "react";
import { useToast } from "../context/ToastContext";
import { api, money } from "../lib/api";
import type { DeliveryZone } from "../types";

type Settings = Record<string, string>;

const emptyZone = (): Partial<DeliveryZone> => ({
  name: "",
  fee: 0,
  minOrder: 0,
  estimatedTime: "30–45 min",
  maxDistanceKm: null,
  centerLat: null,
  centerLng: null,
  isAvailable: true,
});

export function AdminDelivery() {
  const toast = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [revenue, setRevenue] = useState<{ deliveryFeesCollected: number; deliverySales: number; deliveryOrders: number; completedDeliveries: number } | null>(null);
  const [editZone, setEditZone] = useState<Partial<DeliveryZone> | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  async function loadAll() {
    const [s, z, r] = await Promise.all([
      api.get<Settings>("/api/delivery/settings"),
      api.get<DeliveryZone[]>("/api/delivery/zones"),
      api.get<typeof revenue>("/api/delivery/revenue"),
    ]);
    setSettings(s);
    setZones(z);
    setRevenue(r);
  }
  useEffect(() => {
    loadAll().catch(() => {});
  }, []);

  if (!settings) return <p className="text-charcoal/60">Loading…</p>;

  const set = (k: string, v: string) => setSettings({ ...settings, [k]: v });
  const bool = (k: string) => settings[k] === "true";
  const toggle = (k: string) => set(k, bool(k) ? "false" : "true");

  async function saveSettings() {
    setSavingSettings(true);
    try {
      await api.patch("/api/delivery/settings", settings);
      toast("Settings saved.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save.", "error");
    } finally {
      setSavingSettings(false);
    }
  }

  async function saveZone() {
    if (!editZone) return;
    if (!editZone.name?.trim()) return toast("Zone name is required.", "error");
    try {
      if (editZone.id) await api.patch(`/api/delivery/zones/${editZone.id}`, editZone);
      else await api.post("/api/delivery/zones", editZone);
      setEditZone(null);
      loadAll();
      toast("Zone saved.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save zone.", "error");
    }
  }

  async function deleteZone(z: DeliveryZone) {
    if (!confirm(`Delete zone "${z.name}"?`)) return;
    await api.delete(`/api/delivery/zones/${z.id}`);
    loadAll();
    toast("Zone deleted.");
  }

  const Toggle = ({ k, label, hint }: { k: string; label: string; hint?: string }) => (
    <button
      type="button"
      onClick={() => toggle(k)}
      className={`flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition ${bool(k) ? "border-sage bg-sage/10" : "border-oat bg-white"}`}
    >
      <span>
        <span className="font-semibold text-espresso">{label}</span>
        {hint && <span className="block text-xs text-charcoal/50">{hint}</span>}
      </span>
      <span className={`relative h-6 w-11 rounded-full transition ${bool(k) ? "bg-sage" : "bg-oat"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${bool(k) ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  );

  const inp = "mt-1 w-full rounded-xl border border-oat bg-white px-3.5 py-2.5 text-sm";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold text-espresso">Delivery</h1>
        {revenue && (
          <div className="flex gap-2 text-xs">
            <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">Fees collected <b>{money(revenue.deliveryFeesCollected)}</b></span>
            <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">Delivery sales <b>{money(revenue.deliverySales)}</b></span>
            <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">Completed <b>{revenue.completedDeliveries}</b></span>
          </div>
        )}
      </div>

      {/* Availability + settings */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="font-display text-xl font-bold text-espresso">Availability</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Toggle k="delivery.enabled" label="Delivery enabled" hint="Master switch for delivery orders" />
          <Toggle k="delivery.paused" label="Pause delivery (busy)" hint="Customers can still order pickup" />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-espresso">
            Free delivery threshold ($) <span className="font-normal text-charcoal/50">(0 = off)</span>
            <input type="number" min={0} step="0.5" value={settings["delivery.freeThreshold"]} onChange={(e) => set("delivery.freeThreshold", e.target.value)} className={inp} />
          </label>
          <label className="block text-sm font-semibold text-espresso">
            Default estimated time
            <input value={settings["delivery.defaultEstimate"]} onChange={(e) => set("delivery.defaultEstimate", e.target.value)} className={inp} />
          </label>
        </div>

        <div className="mt-4">
          <Toggle k="delivery.hoursEnabled" label="Limit delivery to operating hours" />
          {bool("delivery.hoursEnabled") && (
            <div className="mt-2 grid grid-cols-2 gap-3">
              <label className="block text-sm font-semibold text-espresso">Open<input type="time" value={settings["delivery.hoursStart"]} onChange={(e) => set("delivery.hoursStart", e.target.value)} className={inp} /></label>
              <label className="block text-sm font-semibold text-espresso">Close<input type="time" value={settings["delivery.hoursEnd"]} onChange={(e) => set("delivery.hoursEnd", e.target.value)} className={inp} /></label>
            </div>
          )}
        </div>

        <h2 className="mt-6 font-display text-xl font-bold text-espresso">Pickup</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Toggle k="pickup.enabled" label="Pickup enabled" />
          <Toggle k="pickup.scheduleEnabled" label="Allow scheduled pickup times" />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-espresso">Prep time<input value={settings["pickup.prepTime"]} onChange={(e) => set("pickup.prepTime", e.target.value)} className={inp} /></label>
          <label className="block text-sm font-semibold text-espresso">Pickup location<input value={settings["pickup.location"]} onChange={(e) => set("pickup.location", e.target.value)} className={inp} /></label>
        </div>

        <h2 className="mt-6 font-display text-xl font-bold text-espresso">Payment methods</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Toggle k="payment.online.enabled" label="Pay online (card)" />
          <Toggle k="payment.cashOnDelivery.enabled" label="Cash on delivery" />
          <Toggle k="payment.cashAtPickup.enabled" label="Cash at pickup" />
        </div>

        <h2 className="mt-6 font-display text-xl font-bold text-espresso">In-store register (POS)</h2>
        <p className="mt-1 text-xs text-charcoal/50">Turn this on once the bank account and card machine are ready — then the cashier can take card payments at the counter.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Toggle k="pos.card.enabled" label="Accept cards at the register" hint="Off = cash only" />
          {bool("pos.card.enabled") && <Toggle k="pos.card.requireApprovalCode" label="Require terminal approval code" hint="Cashier keys in the code from the bank machine receipt" />}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-espresso">
            Staff discount (%) <span className="font-normal text-charcoal/50">(0 = off)</span>
            <input type="number" min={0} max={100} step="1" value={settings["staff.discount.percent"]} onChange={(e) => set("staff.discount.percent", e.target.value)} className={inp} />
          </label>
        </div>

        <h2 className="mt-6 font-display text-xl font-bold text-espresso">Tax</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-espresso">Tax rate (%)<input type="number" min={0} step="0.1" value={settings["tax.rate"]} onChange={(e) => set("tax.rate", e.target.value)} className={inp} /></label>
          <label className="block text-sm font-semibold text-espresso">Tax label<input value={settings["tax.label"]} onChange={(e) => set("tax.label", e.target.value)} className={inp} /></label>
        </div>

        <button onClick={saveSettings} disabled={savingSettings} className="btn-3d mt-6 rounded-full bg-espresso px-6 py-2.5 font-semibold text-cream disabled:opacity-60">
          {savingSettings ? "Saving…" : "Save settings"}
        </button>
      </section>

      {/* Zones */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-espresso">Delivery zones</h2>
          <button onClick={() => setEditZone(emptyZone())} className="btn-3d rounded-full bg-terracotta px-5 py-2 text-sm font-semibold text-cream">+ Add zone</button>
        </div>

        {editZone && (
          <div className="mt-4 rounded-xl border border-oat bg-oat/20 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-espresso">Zone / area name<input value={editZone.name ?? ""} onChange={(e) => setEditZone({ ...editZone, name: e.target.value })} className={inp} /></label>
              <label className="block text-sm font-semibold text-espresso">Estimated time<input value={editZone.estimatedTime ?? ""} onChange={(e) => setEditZone({ ...editZone, estimatedTime: e.target.value })} className={inp} /></label>
              <label className="block text-sm font-semibold text-espresso">Delivery fee ($)<input type="number" min={0} step="0.5" value={editZone.fee ?? 0} onChange={(e) => setEditZone({ ...editZone, fee: Number(e.target.value) })} className={inp} /></label>
              <label className="block text-sm font-semibold text-espresso">Minimum order ($)<input type="number" min={0} step="0.5" value={editZone.minOrder ?? 0} onChange={(e) => setEditZone({ ...editZone, minOrder: Number(e.target.value) })} className={inp} /></label>
            </div>
            <p className="mt-3 text-xs font-semibold text-charcoal/60">Location-based delivery (optional) — set a centre + max distance to match by map pin.</p>
            <div className="mt-1 grid gap-3 sm:grid-cols-3">
              <label className="block text-sm font-semibold text-espresso">Max distance (km)<input type="number" min={0} step="0.5" value={editZone.maxDistanceKm ?? ""} onChange={(e) => setEditZone({ ...editZone, maxDistanceKm: e.target.value === "" ? null : Number(e.target.value) })} className={inp} /></label>
              <label className="block text-sm font-semibold text-espresso">Centre latitude<input type="number" step="any" value={editZone.centerLat ?? ""} onChange={(e) => setEditZone({ ...editZone, centerLat: e.target.value === "" ? null : Number(e.target.value) })} className={inp} /></label>
              <label className="block text-sm font-semibold text-espresso">Centre longitude<input type="number" step="any" value={editZone.centerLng ?? ""} onChange={(e) => setEditZone({ ...editZone, centerLng: e.target.value === "" ? null : Number(e.target.value) })} className={inp} /></label>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-espresso">
              <input type="checkbox" checked={editZone.isAvailable !== false} onChange={(e) => setEditZone({ ...editZone, isAvailable: e.target.checked })} className="h-4 w-4" />
              Available for delivery
            </label>
            <div className="mt-4 flex gap-2">
              <button onClick={saveZone} className="btn-3d rounded-full bg-espresso px-6 py-2 text-sm font-semibold text-cream">Save zone</button>
              <button onClick={() => setEditZone(null)} className="rounded-full border border-oat px-6 py-2 text-sm font-semibold text-espresso">Cancel</button>
            </div>
          </div>
        )}

        <div className="mt-4 space-y-2">
          {zones.length === 0 && <p className="text-sm text-charcoal/50">No zones yet. Add one so customers can order delivery.</p>}
          {zones.map((z) => (
            <div key={z.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-oat px-4 py-3">
              <div>
                <p className="font-semibold text-espresso">
                  {z.name} {!z.isAvailable && <span className="ml-1 rounded-full bg-terracotta/15 px-2 py-0.5 text-xs text-terracotta-dark">Off</span>}
                </p>
                <p className="text-xs text-charcoal/60">
                  {money(z.fee)} fee · min {money(z.minOrder)} · {z.estimatedTime}
                  {z.maxDistanceKm != null && ` · ≤${z.maxDistanceKm}km`}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditZone(z)} className="rounded-full border border-oat px-4 py-1.5 text-sm font-semibold text-espresso hover:bg-oat">Edit</button>
                <button onClick={() => deleteZone(z)} className="rounded-full border border-terracotta/40 px-4 py-1.5 text-sm font-semibold text-terracotta-dark hover:bg-terracotta hover:text-cream">Delete</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

type Level = "OUT" | "LOW" | "PREORDER";
type Alert = { key: string; name: string; sub: string; level: Level; detail: string };

// Where each kind of alert comes from + where the manager fixes it.
const SECTIONS = [
  { id: "ingredients", title: "Ingredients", icon: "🧺", to: "/admin/stock", manage: "Ingredients Inventory" },
  { id: "cafe", title: "Café products", icon: "🥪", to: "/admin/inventory", manage: "Retail Product Stock" },
  { id: "shop", title: "Shop / Retail", icon: "🛍", to: "/admin/shop-products", manage: "Shop Products" },
  { id: "hanson", title: "Hanson Doughnuts", icon: "🍩", to: "/admin/hanson-production", manage: "Daily Production" },
] as const;

const BADGE: Record<Level, string> = {
  OUT: "bg-terracotta/15 text-terracotta-dark",
  LOW: "bg-amber-400/25 text-amber-800",
  PREORDER: "bg-[#5b3fd6]/15 text-[#5b3fd6]",
};

export function AdminLowStock() {
  // null = still loading that section.
  const [data, setData] = useState<Record<string, Alert[] | null>>({
    ingredients: null, cafe: null, shop: null, hanson: null,
  });
  const set = (id: string, alerts: Alert[]) => setData((d) => ({ ...d, [id]: alerts }));

  useEffect(() => {
    api.get<{ items: { id: number; name: string; category: string; quantity: number; minQty: number; unit: string }[] }>("/api/stock")
      .then((r) => set("ingredients", r.items.flatMap((i) =>
        i.quantity <= 0 ? [{ key: `i${i.id}`, name: i.name, sub: i.category || "Ingredient", level: "OUT" as Level, detail: `0 ${i.unit}` }]
          : i.quantity <= i.minQty ? [{ key: `i${i.id}`, name: i.name, sub: i.category || "Ingredient", level: "LOW" as Level, detail: `${i.quantity} ${i.unit} left` }]
            : []))).catch(() => set("ingredients", []));

    api.get<{ items: { id: number; name: string; category: string; trackStock: boolean; stockQty: number; lowStockAt: number }[] }>("/api/inventory")
      .then((r) => set("cafe", r.items.filter((i) => i.trackStock).flatMap((i) =>
        i.stockQty <= 0 ? [{ key: `c${i.id}`, name: i.name, sub: i.category, level: "OUT" as Level, detail: "0 left" }]
          : i.stockQty <= i.lowStockAt ? [{ key: `c${i.id}`, name: i.name, sub: i.category, level: "LOW" as Level, detail: `${i.stockQty} left` }]
            : []))).catch(() => set("cafe", []));

    api.get<{ id: number; name: string; category: string; quantity: number; status: string; allowPreorder: boolean }[]>("/api/shop/admin/all")
      .then((r) => set("shop", r.flatMap((p) =>
        p.status === "OUT" ? [{ key: `s${p.id}`, name: p.name, sub: p.category, level: "OUT" as Level, detail: "Out of stock" }]
          : p.status === "PREORDER" ? [{ key: `s${p.id}`, name: p.name, sub: p.category, level: "PREORDER" as Level, detail: "Out · preorder on" }]
            : p.status === "LOW" ? [{ key: `s${p.id}`, name: p.name, sub: p.category, level: "LOW" as Level, detail: `${p.quantity} left` }]
              : []))).catch(() => set("shop", []));

    api.get<{ id: number; name: string; subcategory?: string; tracked?: boolean; soldOut?: boolean; remaining?: number }[]>("/api/doughnuts")
      .then((r) => set("hanson", r.filter((d) => d.tracked && d.soldOut).map((d) => ({
        key: `h${d.id}`, name: d.name, sub: d.subcategory || "Doughnut", level: "OUT" as Level, detail: "Sold out today",
      })))).catch(() => set("hanson", []));
  }, []);

  const total = Object.values(data).reduce((n, a) => n + (a?.length ?? 0), 0);
  const anyLoading = Object.values(data).some((a) => a === null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-espresso">Low stock alerts</h1>
          <p className="mt-1 text-sm text-charcoal/60">Everything that's running low or out — across ingredients, café products, the shop and Hanson.</p>
        </div>
        <span className={`rounded-full px-4 py-2 text-sm font-bold ${total > 0 ? "bg-terracotta/15 text-terracotta-dark" : "bg-sage/20 text-sage-dark"}`}>
          {anyLoading ? "Checking…" : total === 0 ? "All stocked ✓" : `${total} need attention`}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {SECTIONS.map((s) => {
          const alerts = data[s.id];
          return (
            <section key={s.id} className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold text-espresso">
                  <span>{s.icon}</span>{s.title}
                  {alerts && alerts.length > 0 && (
                    <span className="rounded-full bg-terracotta/15 px-2 py-0.5 text-xs font-bold text-terracotta-dark">{alerts.length}</span>
                  )}
                </h2>
                <Link to={s.to} className="text-xs font-semibold text-terracotta hover:underline">{s.manage} →</Link>
              </div>
              <div className="mt-3 space-y-1.5">
                {alerts === null ? (
                  <p className="text-sm text-charcoal/40">Loading…</p>
                ) : alerts.length === 0 ? (
                  <p className="rounded-xl bg-sage/10 px-3 py-2 text-sm font-medium text-sage-dark">All good — nothing low here ✓</p>
                ) : (
                  alerts.map((a) => (
                    <div key={a.key} className="flex items-center justify-between gap-2 rounded-xl border border-oat px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-espresso">{a.name}</p>
                        <p className="truncate text-xs text-charcoal/45">{a.sub}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${BADGE[a.level]}`}>{a.detail}</span>
                    </div>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

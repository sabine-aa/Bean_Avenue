import { useEffect, useState } from "react";
import { useToast } from "../context/ToastContext";
import { api, formatDateTime } from "../lib/api";
import type { LoyaltyTransaction, Redemption } from "../types";

const TYPE_LABEL: Record<string, string> = {
  EARN: "Earned",
  REDEEM: "Redeemed",
  ADJUST: "Adjustment",
};

export function AdminLoyalty() {
  const toast = useToast();
  const [tab, setTab] = useState<"ledger" | "vouchers">("ledger");
  const [filter, setFilter] = useState("");
  const [ledger, setLedger] = useState<LoyaltyTransaction[]>([]);
  const [vouchers, setVouchers] = useState<Redemption[]>([]);

  const loadLedger = () => api.get<LoyaltyTransaction[]>(`/api/loyalty/ledger${filter ? `?type=${filter}` : ""}`).then(setLedger);
  const loadVouchers = () => api.get<Redemption[]>("/api/loyalty/redemptions").then(setVouchers);

  useEffect(() => {
    loadLedger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);
  useEffect(() => {
    loadVouchers();
  }, []);

  async function setStatus(v: Redemption, status: Redemption["status"]) {
    try {
      await api.patch(`/api/loyalty/redemptions/${v.id}`, { status });
      toast(status === "CLAIMED" ? "Voucher marked claimed." : "Voucher updated.");
      loadVouchers();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't update.", "error");
    }
  }

  return (
    <div>
      <h1 className="font-display text-espresso text-3xl font-bold">Loyalty Points</h1>
      <p className="text-charcoal/60 mt-1 text-sm">Every point earned, redeemed, or adjusted across all customers.</p>

      <div className="mt-4 flex gap-2">
        {(["ledger", "vouchers"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-5 py-2 text-sm font-semibold ${tab === t ? "bg-espresso text-cream" : "bg-oat text-espresso"}`}
          >
            {t === "ledger" ? "Points ledger" : "Vouchers"}
          </button>
        ))}
      </div>

      {tab === "ledger" ? (
        <>
          <div className="mt-4 flex gap-2">
            {["", "EARN", "REDEEM", "ADJUST"].map((f) => (
              <button
                key={f || "all"}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === f ? "bg-espresso text-cream" : "bg-oat text-espresso"}`}
              >
                {f ? TYPE_LABEL[f] : "All"}
              </button>
            ))}
          </div>

          <div className="mt-4 overflow-x-auto rounded-2xl bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-oat text-charcoal/50 border-b text-left text-xs tracking-wide uppercase">
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Detail</th>
                  <th className="px-4 py-3 text-right">Change</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {ledger.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-charcoal/60 px-4 py-8 text-center">
                      No transactions yet.
                    </td>
                  </tr>
                )}
                {ledger.map((t) => (
                  <tr key={t.id} className="border-oat/60 border-b">
                    <td className="text-charcoal/70 px-4 py-3 whitespace-nowrap">{formatDateTime(t.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className="text-espresso font-semibold">{t.customer?.name ?? "—"}</span>
                      <span className="text-charcoal/50 block text-xs">{t.customer?.phone}</span>
                    </td>
                    <td className="px-4 py-3">
                      {t.note ?? TYPE_LABEL[t.type]}
                      {t.refId && <span className="text-charcoal/50 block text-xs">{t.refId}</span>}
                    </td>
                    <td className={`px-4 py-3 text-right font-bold ${t.amount > 0 ? "text-sage-dark" : "text-terracotta-dark"}`}>
                      {t.amount > 0 ? "+" : ""}
                      {t.amount}
                    </td>
                    <td className="text-espresso px-4 py-3 text-right font-semibold">{t.balanceAfter}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-oat text-charcoal/50 border-b text-left text-xs tracking-wide uppercase">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Reward</th>
                <th className="px-4 py-3">Cost</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {vouchers.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-charcoal/60 px-4 py-8 text-center">
                    No vouchers redeemed yet.
                  </td>
                </tr>
              )}
              {vouchers.map((v) => (
                <tr key={v.id} className="border-oat/60 border-b">
                  <td className="text-espresso px-4 py-3 font-mono font-semibold">{v.code}</td>
                  <td className="px-4 py-3">
                    <span className="text-espresso font-semibold">{v.customer?.name ?? "—"}</span>
                    <span className="text-charcoal/50 block text-xs">{v.customer?.phone}</span>
                  </td>
                  <td className="px-4 py-3">{v.rewardName}</td>
                  <td className="px-4 py-3">{v.cost} beans</td>
                  <td className="text-charcoal/70 px-4 py-3 whitespace-nowrap">{formatDateTime(v.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        v.status === "ACTIVE"
                          ? "bg-sage/20 text-sage-dark"
                          : v.status === "CLAIMED"
                            ? "bg-oat text-charcoal/60"
                            : "bg-terracotta/15 text-terracotta-dark"
                      }`}
                    >
                      {v.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {v.status === "ACTIVE" && (
                      <button
                        onClick={() => setStatus(v, "CLAIMED")}
                        className="bg-espresso text-cream hover:bg-mocha rounded-full px-3 py-1 text-xs font-semibold"
                      >
                        Mark claimed
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

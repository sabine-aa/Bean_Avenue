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

  const loadLedger = () =>
    api
      .get<LoyaltyTransaction[]>(`/api/loyalty/ledger${filter ? `?type=${filter}` : ""}`)
      .then(setLedger);
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
      <h1 className="font-display text-3xl font-bold text-espresso">Loyalty Points</h1>
      <p className="mt-1 text-sm text-charcoal/60">
        Every point earned, redeemed, or adjusted across all customers.
      </p>

      <div className="mt-4 flex gap-2">
        {(["ledger", "vouchers"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-5 py-2 text-sm font-semibold ${
              tab === t ? "bg-espresso text-cream" : "bg-oat text-espresso"
            }`}
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
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  filter === f ? "bg-espresso text-cream" : "bg-oat text-espresso"
                }`}
              >
                {f ? TYPE_LABEL[f] : "All"}
              </button>
            ))}
          </div>

          <div className="mt-4 overflow-x-auto rounded-2xl bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-oat text-left text-xs uppercase tracking-wide text-charcoal/50">
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
                    <td colSpan={5} className="px-4 py-8 text-center text-charcoal/60">
                      No transactions yet.
                    </td>
                  </tr>
                )}
                {ledger.map((t) => (
                  <tr key={t.id} className="border-b border-oat/60">
                    <td className="whitespace-nowrap px-4 py-3 text-charcoal/70">
                      {formatDateTime(t.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-espresso">{t.customer?.name ?? "—"}</span>
                      <span className="block text-xs text-charcoal/50">{t.customer?.phone}</span>
                    </td>
                    <td className="px-4 py-3">
                      {t.note ?? TYPE_LABEL[t.type]}
                      {t.refId && <span className="block text-xs text-charcoal/50">{t.refId}</span>}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-bold ${
                        t.amount > 0 ? "text-sage-dark" : "text-terracotta-dark"
                      }`}
                    >
                      {t.amount > 0 ? "+" : ""}
                      {t.amount}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-espresso">
                      {t.balanceAfter}
                    </td>
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
              <tr className="border-b border-oat text-left text-xs uppercase tracking-wide text-charcoal/50">
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
                  <td colSpan={7} className="px-4 py-8 text-center text-charcoal/60">
                    No vouchers redeemed yet.
                  </td>
                </tr>
              )}
              {vouchers.map((v) => (
                <tr key={v.id} className="border-b border-oat/60">
                  <td className="px-4 py-3 font-mono font-semibold text-espresso">{v.code}</td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-espresso">{v.customer?.name ?? "—"}</span>
                    <span className="block text-xs text-charcoal/50">{v.customer?.phone}</span>
                  </td>
                  <td className="px-4 py-3">{v.rewardName}</td>
                  <td className="px-4 py-3">{v.cost} beans</td>
                  <td className="whitespace-nowrap px-4 py-3 text-charcoal/70">
                    {formatDateTime(v.createdAt)}
                  </td>
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
                        className="rounded-full bg-espresso px-3 py-1 text-xs font-semibold text-cream hover:bg-mocha"
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

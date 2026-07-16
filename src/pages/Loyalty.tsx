import { useEffect, useState } from "react";
import { CustomerAuth } from "../components/CustomerAuth";
import { AwardIcon, CheckIcon } from "../components/icons";
import { Img } from "../components/Img";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { useToast } from "../context/ToastContext";
import { api, customerApi, formatDateTime } from "../lib/api";
import type { LoyaltyAccount, Reward } from "../types";

// Presentational identity for each tier (benefits live here, not in the DB).
const TIER_META: Record<string, { color: string; badge: string; soft: string; benefits: string[] }> = {
  Bronze: {
    color: "#b06f3c",
    badge: "linear-gradient(135deg, #d98a4e, #8a5523)",
    soft: "rgba(176,111,60,0.07)",
    benefits: ["Earn beans on every order", "Earn beans on room bookings", "Access to standard rewards"],
  },
  Silver: {
    color: "#8c919b",
    badge: "linear-gradient(135deg, #d3d8df, #878d97)",
    soft: "rgba(140,145,155,0.10)",
    benefits: ["Everything in Bronze", "Bonus-bean promotions", "Special member offers", "Occasional surprise rewards"],
  },
  Gold: {
    color: "#c9a227",
    badge: "linear-gradient(135deg, #f0d572, #c29a1f)",
    soft: "rgba(201,162,39,0.12)",
    benefits: ["Everything in Silver", "Priority room booking", "Birthday reward", "Exclusive Gold offers"],
  },
};

export function Loyalty() {
  const toast = useToast();
  const { account, loading, logout, refresh } = useCustomerAuth();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [tiers, setTiers] = useState<{ name: string; min: number }[]>([]);
  const [catFilter, setCatFilter] = useState("all");

  useEffect(() => {
    api
      .get<{ rewards: Reward[]; tiers: { name: string; min: number }[] }>("/api/loyalty/rewards")
      .then((res) => {
        setRewards(res.rewards);
        setTiers(res.tiers);
      })
      .catch(() => {});
  }, []);

  async function redeem(reward: Reward) {
    if (!account) return;
    if (account.beanBalance < reward.cost) return;
    try {
      const res = await customerApi.post<LoyaltyAccount>("/api/loyalty/redeem", { rewardId: reward.id });
      toast(res.message ?? `Redeemed: ${reward.name}`);
      await refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't redeem that.", "error");
    }
  }

  const activeVouchers = account?.redemptions?.filter((r) => r.status === "ACTIVE") ?? [];

  // Distinct categories (in the backend's category-sorted order) for the filter chips.
  const categories = rewards.reduce<string[]>((acc, r) => {
    const key = r.category || "Other";
    if (!acc.includes(key)) acc.push(key);
    return acc;
  }, []);
  const visibleRewards = catFilter === "all" ? rewards : rewards.filter((r) => (r.category || "Other") === catFilter);

  const progress =
    account && account.nextTier ? Math.min(100, Math.round((account.lifetimeBeans / (account.lifetimeBeans + account.nextTier.beansToGo)) * 100)) : 100;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-espresso flex items-center gap-3 text-4xl font-bold">
        Every cup earns you beans.
        <img src="/bean.png" alt="" className="float-bean h-10 w-10" />
      </h1>
      <p className="text-charcoal/70 mt-2 max-w-2xl">
        Earn 1 bean per $1 spent — on food orders <em>and</em> room bookings. Trade beans for free drinks, pastries, and more.
      </p>

      {loading ? (
        <p className="text-charcoal/60 mt-10">Loading your account…</p>
      ) : !account ? (
        <div className="mt-8 max-w-md">
          <CustomerAuth />
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          <div className="bg-espresso text-cream rounded-2xl p-6 shadow-lg">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-oat text-sm">Hey {account.name} ☕</p>
                <p className="font-display mt-1 text-5xl font-bold">
                  {account.beanBalance}
                  <span className="text-oat ml-2 text-xl font-medium">beans</span>
                </p>
                <p className="text-oat/80 mt-1 text-xs">{account.lifetimeBeans} earned all-time</p>
              </div>
              <div className="text-right">
                <p className="bg-sage text-cream rounded-full px-4 py-1 text-sm font-bold">{account.tier}</p>
                <button
                  onClick={() => {
                    logout();
                    toast("Logged out.");
                  }}
                  className="text-oat/70 mt-2 block text-xs underline-offset-2 hover:underline"
                >
                  Log out
                </button>
              </div>
            </div>
            {account.nextTier && (
              <div className="mt-5">
                <div className="text-oat flex justify-between text-xs">
                  <span>{account.tier}</span>
                  <span>
                    {account.nextTier.beansToGo} beans to {account.nextTier.name}
                  </span>
                </div>
                <div className="bg-mocha mt-1 h-2 overflow-hidden rounded-full">
                  <div className="bg-sage h-full rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
          </div>

          {activeVouchers.length > 0 && (
            <section>
              <h2 className="font-display text-espresso text-2xl font-bold">Your vouchers</h2>
              <p className="text-charcoal/60 text-sm">Show the code at the counter to claim.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {activeVouchers.map((v) => (
                  <div key={v.id} className="border-sage bg-sage/10 flex items-center justify-between rounded-2xl border-2 border-dashed p-4">
                    <div>
                      <p className="text-espresso font-semibold">{v.rewardName}</p>
                      <p className="text-charcoal/60 text-xs">
                        {v.cost} beans · {formatDateTime(v.createdAt)}
                      </p>
                    </div>
                    <span className="bg-espresso text-cream rounded-lg px-3 py-1.5 font-mono text-sm font-bold">{v.code}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="font-display text-espresso text-2xl font-bold">Rewards</h2>
            <p className="text-charcoal/60 text-sm">Redeem your beans for free items across the menu.</p>

            {/* Category filters */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => setCatFilter("all")}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  catFilter === "all" ? "bg-espresso text-cream" : "bg-oat text-espresso hover:bg-oat/70"
                }`}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCatFilter(c)}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                    catFilter === c ? "bg-espresso text-cream" : "bg-oat text-espresso hover:bg-oat/70"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            {visibleRewards.length === 0 ? (
              <p className="text-charcoal/60 mt-5">No rewards available right now — check back soon.</p>
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visibleRewards.map((r) => {
                  const affordable = account.beanBalance >= r.cost;
                  const toGo = r.cost - account.beanBalance;
                  return (
                    <div key={r.id} className="card-lift flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm">
                      <div className="relative">
                        <Img src={r.image} alt={r.name} className="h-36 w-full" />
                        {r.category && (
                          <span className="bg-espresso/85 text-cream absolute top-2 left-2 rounded-full px-2.5 py-0.5 text-xs font-semibold">{r.category}</span>
                        )}
                        {!r.isAvailable && (
                          <span className="bg-terracotta-dark text-cream absolute top-2 right-2 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                            Unavailable
                          </span>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col p-4 text-center">
                        <p className="text-espresso font-semibold">{r.name}</p>
                        {r.description && <p className="text-charcoal/60 mt-1 text-xs">{r.description}</p>}
                        <p className="text-sage-dark mt-1 text-sm font-semibold">{r.cost} beans</p>
                        <div className="mt-auto pt-3">
                          {!r.isAvailable ? (
                            <button disabled className="bg-oat text-charcoal/40 w-full cursor-not-allowed rounded-full px-4 py-2 text-sm font-semibold">
                              Currently unavailable
                            </button>
                          ) : (
                            <button
                              onClick={() => redeem(r)}
                              disabled={!affordable}
                              className="btn-3d bg-terracotta text-cream disabled:bg-oat disabled:text-charcoal/40 w-full rounded-full px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed"
                            >
                              {affordable ? "Redeem" : `${toGo} beans to go`}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {account.transactions && account.transactions.length > 0 && (
            <section>
              <h2 className="font-display text-espresso text-2xl font-bold">Points history</h2>
              <ul className="divide-oat mt-4 divide-y rounded-2xl bg-white shadow-sm">
                {account.transactions.map((t) => (
                  <li key={t.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <span>
                      {t.note ?? (t.type === "EARN" ? `Earned on ${t.refId ?? t.source}` : t.source)}
                      <span className="text-charcoal/50 block text-xs">
                        {formatDateTime(t.createdAt)} · balance {t.balanceAfter}
                      </span>
                    </span>
                    <span className={`font-bold ${t.amount > 0 ? "text-sage-dark" : "text-terracotta-dark"}`}>
                      {t.amount > 0 ? "+" : ""}
                      {t.amount}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <section className="mt-14">
        <h2 className="font-display text-espresso text-3xl font-bold">Membership tiers</h2>
        <p className="text-charcoal/60 mt-1">The more you sip, the more you unlock. Beans you earn count toward your tier for life.</p>
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          {tiers.map((t) => {
            const meta = TIER_META[t.name] ?? TIER_META.Bronze;
            const isCurrent = account?.tier === t.name;
            const requirement = t.min === 0 ? "Starting tier" : `${t.min}+ lifetime beans`;
            const next = isCurrent ? account?.nextTier : null;
            const pct = next ? Math.min(100, Math.round((account!.lifetimeBeans / (account!.lifetimeBeans + next.beansToGo)) * 100)) : 100;
            return (
              <div
                key={t.name}
                className={`group flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-xl ${
                  isCurrent ? "border-transparent ring-2" : "border-oat"
                }`}
                style={{
                  ...(isCurrent ? { boxShadow: `0 0 0 2px ${meta.color}`, background: `linear-gradient(${meta.soft}, transparent 60%)` } : {}),
                }}
              >
                <div className="h-1.5 w-full" style={{ background: meta.badge }} />
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-md transition group-hover:scale-105"
                      style={{ background: meta.badge }}
                    >
                      <AwardIcon className="h-6 w-6" />
                    </span>
                    {isCurrent && (
                      <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ background: meta.color }}>
                        Your current tier
                      </span>
                    )}
                  </div>

                  <h3 className="font-display text-espresso mt-4 text-2xl font-bold">{t.name}</h3>
                  <p className="text-sm font-bold" style={{ color: meta.color }}>
                    {requirement}
                  </p>

                  {isCurrent && (
                    <div className="mt-3">
                      <div className="bg-oat h-2 overflow-hidden rounded-full">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: meta.color }} />
                      </div>
                      <p className="text-charcoal/70 mt-1.5 text-xs font-medium">
                        {next
                          ? `${account!.lifetimeBeans} of ${account!.lifetimeBeans + next.beansToGo} lifetime beans — ${next.beansToGo} until ${next.name}`
                          : "You've reached the highest tier."}
                      </p>
                    </div>
                  )}

                  <ul className="mt-4 space-y-2">
                    {meta.benefits.map((b) => (
                      <li key={b} className="text-charcoal/80 flex items-start gap-2 text-sm">
                        <span style={{ color: meta.color }} className="mt-0.5 shrink-0">
                          <CheckIcon className="h-4 w-4" />
                        </span>
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

import { FormEvent, useEffect, useState } from "react";
import { useToast } from "../context/ToastContext";
import { api, formatDateTime } from "../lib/api";
import type { LoyaltyAccount } from "../types";

interface Reward {
  id: string;
  name: string;
  cost: number;
}

const PHONE_KEY = "bean-avenue-loyalty-phone";

export function Loyalty() {
  const toast = useToast();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [tiers, setTiers] = useState<{ name: string; min: number }[]>([]);
  const [account, setAccount] = useState<LoyaltyAccount | null>(null);
  const [mode, setMode] = useState<"lookup" | "join">("lookup");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<{ rewards: Reward[]; tiers: { name: string; min: number }[] }>("/api/loyalty/rewards")
      .then((res) => {
        setRewards(res.rewards);
        setTiers(res.tiers);
      })
      .catch(() => {});
    try {
      const saved = localStorage.getItem(PHONE_KEY);
      if (saved) {
        setPhone(saved);
        api.get<LoyaltyAccount>(`/api/loyalty/account/${encodeURIComponent(saved)}`)
          .then(setAccount)
          .catch(() => {});
      }
    } catch {
      /* no saved phone */
    }
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const acct =
        mode === "join"
          ? await api.post<LoyaltyAccount>("/api/loyalty/join", { name, phone })
          : await api.get<LoyaltyAccount>(`/api/loyalty/account/${encodeURIComponent(phone)}`);
      setAccount(acct);
      try {
        localStorage.setItem(PHONE_KEY, phone);
      } catch { /* fine */ }
      if (mode === "join") {
        toast(acct.alreadyMember ? "Welcome back! You're already a member." : "Welcome to the avenue! 🫘");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function redeem(reward: Reward) {
    if (!account) return;
    try {
      const res = await api.post<LoyaltyAccount>("/api/loyalty/redeem", {
        phone: account.phone,
        rewardId: reward.id,
      });
      toast(res.message ?? `Redeemed: ${reward.name}`);
      const refreshed = await api.get<LoyaltyAccount>(
        `/api/loyalty/account/${encodeURIComponent(account.phone)}`
      );
      setAccount(refreshed);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't redeem that.", "error");
    }
  }

  const progress =
    account && account.nextTier
      ? Math.min(
          100,
          Math.round(
            (account.lifetimeBeans /
              (account.lifetimeBeans + account.nextTier.beansToGo)) *
              100
          )
        )
      : 100;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="flex items-center gap-3 font-display text-4xl font-bold text-espresso">
        Every cup earns you beans.
        <img src="/bean.png" alt="" className="float-bean h-10 w-10" />
      </h1>
      <p className="mt-2 max-w-2xl text-charcoal/70">
        Earn 1 bean per $1 spent — on food orders <em>and</em> room bookings. Trade beans for free
        drinks, pastries, and study hours.
      </p>

      {!account ? (
        <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex gap-2">
            <button
              onClick={() => setMode("lookup")}
              className={`rounded-full px-5 py-2 text-sm font-semibold ${
                mode === "lookup" ? "bg-espresso text-cream" : "bg-oat text-espresso"
              }`}
            >
              I'm a member
            </button>
            <button
              onClick={() => setMode("join")}
              className={`rounded-full px-5 py-2 text-sm font-semibold ${
                mode === "join" ? "bg-espresso text-cream" : "bg-oat text-espresso"
              }`}
            >
              Join free
            </button>
          </div>
          <form onSubmit={handleSubmit} className="mt-5 grid gap-4 sm:grid-cols-2">
            {mode === "join" && (
              <div>
                <label className="block text-sm font-semibold text-espresso" htmlFor="lname">
                  Name
                </label>
                <input
                  id="lname"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-oat px-4 py-2.5"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold text-espresso" htmlFor="lphone">
                Phone
              </label>
              <input
                id="lphone"
                required
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-xl border border-oat px-4 py-2.5"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={busy}
                className="btn-3d w-full rounded-full bg-terracotta px-6 py-2.5 font-semibold text-cream disabled:opacity-60"
              >
                {mode === "join" ? "Join Free" : "Show my beans"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          <div className="rounded-2xl bg-espresso p-6 text-cream shadow-lg">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm text-oat">Hey {account.name} ☕</p>
                <p className="mt-1 font-display text-5xl font-bold">
                  {account.beanBalance}
                  <span className="ml-2 text-xl font-medium text-oat">beans</span>
                </p>
              </div>
              <div className="text-right">
                <p className="rounded-full bg-sage px-4 py-1 text-sm font-bold text-cream">
                  {account.tier}
                </p>
                <button
                  onClick={() => {
                    setAccount(null);
                    try { localStorage.removeItem(PHONE_KEY); } catch { /* fine */ }
                  }}
                  className="mt-2 text-xs text-oat/70 underline-offset-2 hover:underline"
                >
                  Not you? Switch account
                </button>
              </div>
            </div>
            {account.nextTier && (
              <div className="mt-5">
                <div className="flex justify-between text-xs text-oat">
                  <span>{account.tier}</span>
                  <span>
                    {account.nextTier.beansToGo} beans to {account.nextTier.name}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-mocha">
                  <div
                    className="h-full rounded-full bg-sage transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <section>
            <h2 className="font-display text-2xl font-bold text-espresso">Rewards</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {rewards.map((r) => {
                const affordable = account.beanBalance >= r.cost;
                return (
                  <div key={r.id} className="rounded-2xl bg-white p-5 text-center shadow-sm">
                    <p className="text-3xl">{r.id === "drip-coffee" ? "☕" : r.id === "pastry" ? "🥐" : "📚"}</p>
                    <p className="mt-2 font-semibold text-espresso">{r.name}</p>
                    <p className="text-sm text-charcoal/60">{r.cost} beans</p>
                    <button
                      onClick={() => redeem(r)}
                      disabled={!affordable}
                      className="btn-3d mt-3 w-full rounded-full bg-terracotta px-4 py-2 text-sm font-semibold text-cream disabled:cursor-not-allowed disabled:bg-oat disabled:text-charcoal/40"
                    >
                      {affordable ? "Redeem" : "Keep sipping"}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {account.transactions && account.transactions.length > 0 && (
            <section>
              <h2 className="font-display text-2xl font-bold text-espresso">Bean history</h2>
              <ul className="mt-4 divide-y divide-oat rounded-2xl bg-white shadow-sm">
                {account.transactions.map((t) => (
                  <li key={t.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <span>
                      {t.note ?? (t.type === "EARN" ? `Earned on ${t.refId ?? t.source}` : t.source)}
                      <span className="block text-xs text-charcoal/50">
                        {formatDateTime(t.createdAt)}
                      </span>
                    </span>
                    <span
                      className={`font-bold ${t.amount > 0 ? "text-sage-dark" : "text-terracotta-dark"}`}
                    >
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

      <section className="mt-12">
        <h2 className="font-display text-2xl font-bold text-espresso">Tiers</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {tiers.map((t, i) => (
            <div key={t.name} className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-2xl">{["🌱", "🔥", "⭐"][i] ?? "🫘"}</p>
              <p className="mt-2 font-display text-lg font-bold text-espresso">{t.name}</p>
              <p className="text-sm text-charcoal/60">
                {t.min === 0 ? "Everyone starts here" : `${t.min}+ lifetime beans`}
              </p>
              <p className="mt-2 text-sm text-charcoal/70">
                {i === 0 && "Earn beans on every order and booking."}
                {i === 1 && "Bonus-bean days and the occasional surprise."}
                {i === 2 && "Priority room booking and a birthday treat."}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

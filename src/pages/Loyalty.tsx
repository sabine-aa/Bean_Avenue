import { FormEvent, useEffect, useState } from "react";
import { Img } from "../components/Img";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { useToast } from "../context/ToastContext";
import { api, customerApi, formatDateTime } from "../lib/api";
import type { LoyaltyAccount, Reward } from "../types";

export function Loyalty() {
  const toast = useToast();
  const { account, loading, login, signup, logout, refresh } = useCustomerAuth();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [tiers, setTiers] = useState<{ name: string; min: number }[]>([]);

  const [mode, setMode] = useState<"login" | "join">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "join") {
        await signup(name, phone, password);
        toast("Welcome to the avenue! 🫘");
      } else {
        await login(phone, password);
        toast("Welcome back! ☕");
      }
      setPassword("");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong.", "error");
    } finally {
      setBusy(false);
    }
  }

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
  const visibleRewards =
    catFilter === "all" ? rewards : rewards.filter((r) => (r.category || "Other") === catFilter);

  const progress =
    account && account.nextTier
      ? Math.min(
          100,
          Math.round(
            (account.lifetimeBeans / (account.lifetimeBeans + account.nextTier.beansToGo)) * 100
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
        drinks, pastries, and more.
      </p>

      {loading ? (
        <p className="mt-10 text-charcoal/60">Loading your account…</p>
      ) : !account ? (
        <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex gap-2">
            <button
              onClick={() => setMode("login")}
              className={`rounded-full px-5 py-2 text-sm font-semibold ${
                mode === "login" ? "bg-espresso text-cream" : "bg-oat text-espresso"
              }`}
            >
              Log in
            </button>
            <button
              onClick={() => setMode("join")}
              className={`rounded-full px-5 py-2 text-sm font-semibold ${
                mode === "join" ? "bg-espresso text-cream" : "bg-oat text-espresso"
              }`}
            >
              Create account
            </button>
          </div>
          <form onSubmit={handleSubmit} className="mt-5 grid gap-4 sm:grid-cols-2">
            {mode === "join" && (
              <div className="sm:col-span-2">
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
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-xl border border-oat px-4 py-2.5"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-espresso" htmlFor="lpass">
                Password
              </label>
              <input
                id="lpass"
                required
                type="password"
                autoComplete={mode === "join" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-oat px-4 py-2.5"
              />
              {mode === "join" && (
                <p className="mt-1 text-xs text-charcoal/50">At least 6 characters.</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={busy}
                className="btn-3d w-full rounded-full bg-terracotta px-6 py-2.5 font-semibold text-cream disabled:opacity-60"
              >
                {busy ? "One moment…" : mode === "join" ? "Create my account" : "Log in"}
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
                <p className="mt-1 text-xs text-oat/80">
                  {account.lifetimeBeans} earned all-time
                </p>
              </div>
              <div className="text-right">
                <p className="rounded-full bg-sage px-4 py-1 text-sm font-bold text-cream">
                  {account.tier}
                </p>
                <button
                  onClick={() => {
                    logout();
                    toast("Logged out.");
                  }}
                  className="mt-2 block text-xs text-oat/70 underline-offset-2 hover:underline"
                >
                  Log out
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

          {activeVouchers.length > 0 && (
            <section>
              <h2 className="font-display text-2xl font-bold text-espresso">Your vouchers</h2>
              <p className="text-sm text-charcoal/60">Show the code at the counter to claim.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {activeVouchers.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between rounded-2xl border-2 border-dashed border-sage bg-sage/10 p-4"
                  >
                    <div>
                      <p className="font-semibold text-espresso">{v.rewardName}</p>
                      <p className="text-xs text-charcoal/60">{v.cost} beans · {formatDateTime(v.createdAt)}</p>
                    </div>
                    <span className="rounded-lg bg-espresso px-3 py-1.5 font-mono text-sm font-bold text-cream">
                      {v.code}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="font-display text-2xl font-bold text-espresso">Rewards</h2>
            <p className="text-sm text-charcoal/60">
              Redeem your beans for free items across the menu.
            </p>

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
              <p className="mt-5 text-charcoal/60">No rewards available right now — check back soon.</p>
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visibleRewards.map((r) => {
                  const affordable = account.beanBalance >= r.cost;
                  const toGo = r.cost - account.beanBalance;
                  return (
                    <div
                      key={r.id}
                      className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm"
                    >
                      <div className="relative">
                        <Img src={r.image} alt={r.name} className="h-36 w-full" />
                        {r.category && (
                          <span className="absolute left-2 top-2 rounded-full bg-espresso/85 px-2.5 py-0.5 text-xs font-semibold text-cream">
                            {r.category}
                          </span>
                        )}
                        {!r.isAvailable && (
                          <span className="absolute right-2 top-2 rounded-full bg-terracotta-dark px-2.5 py-0.5 text-xs font-semibold text-cream">
                            Unavailable
                          </span>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col p-4 text-center">
                        <p className="font-semibold text-espresso">{r.name}</p>
                        {r.description && (
                          <p className="mt-1 text-xs text-charcoal/60">{r.description}</p>
                        )}
                        <p className="mt-1 text-sm font-semibold text-sage-dark">{r.cost} beans</p>
                        <div className="mt-auto pt-3">
                          {!r.isAvailable ? (
                            <button
                              disabled
                              className="w-full cursor-not-allowed rounded-full bg-oat px-4 py-2 text-sm font-semibold text-charcoal/40"
                            >
                              Currently unavailable
                            </button>
                          ) : (
                            <button
                              onClick={() => redeem(r)}
                              disabled={!affordable}
                              className="btn-3d w-full rounded-full bg-terracotta px-4 py-2 text-sm font-semibold text-cream disabled:cursor-not-allowed disabled:bg-oat disabled:text-charcoal/40"
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
              <h2 className="font-display text-2xl font-bold text-espresso">Points history</h2>
              <ul className="mt-4 divide-y divide-oat rounded-2xl bg-white shadow-sm">
                {account.transactions.map((t) => (
                  <li key={t.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <span>
                      {t.note ?? (t.type === "EARN" ? `Earned on ${t.refId ?? t.source}` : t.source)}
                      <span className="block text-xs text-charcoal/50">
                        {formatDateTime(t.createdAt)} · balance {t.balanceAfter}
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

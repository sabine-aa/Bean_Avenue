import { useState } from "react";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { useToast } from "../context/ToastContext";
import { formatDate } from "../lib/api";
import type { BirthdayVoucher, BirthdayVoucherStatus } from "../types";

const STATUS_META: Record<BirthdayVoucherStatus, { label: string; cls: string }> = {
  AVAILABLE: { label: "Available", cls: "bg-sage/20 text-sage-dark" },
  USED: { label: "Used", cls: "bg-oat text-charcoal/60" },
  EXPIRED: { label: "Expired", cls: "bg-charcoal/15 text-charcoal/60" },
  CANCELLED: { label: "Cancelled", cls: "bg-terracotta/15 text-terracotta-dark" },
};

const vStatus = (v: BirthdayVoucher) => v.effectiveStatus ?? v.status;

/** The customer's birthday reward: claim button, or the issued voucher with its status. */
export function BirthdayRewardCard({ actionableOnly = false }: { actionableOnly?: boolean } = {}) {
  const { account, claimBirthday } = useCustomerAuth();
  const toast = useToast();
  const [claiming, setClaiming] = useState(false);
  const br = account?.birthdayReward;

  if (!br || !br.enabled) return null;

  async function claim() {
    setClaiming(true);
    try {
      await claimBirthday();
      toast("Birthday cupcake voucher created! 🎂");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't claim — please try again.", "error");
    } finally {
      setClaiming(false);
    }
  }

  const voucher = br.voucher;
  const active = voucher && vStatus(voucher) === "AVAILABLE";

  // 1) An active, unused voucher — show it for the counter.
  if (active && voucher) {
    return (
      <div className="overflow-hidden rounded-2xl border-2 border-dashed border-terracotta bg-gradient-to-br from-oat/60 to-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-terracotta-dark">
          <span className="text-2xl">🎂</span>
          <p className="font-display text-lg font-bold">{voucher.rewardName}</p>
        </div>
        <p className="mt-1 text-sm text-charcoal/70">Show this code at the counter to claim your free cupcake.</p>
        <div className="mt-4 rounded-xl bg-espresso px-4 py-4 text-center">
          <p className="text-xs uppercase tracking-widest text-oat/80">Voucher code</p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-[0.2em] text-cream">{voucher.code}</p>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-charcoal/60">
          <span>Issued {formatDate(voucher.issuedAt)}</span>
          <span>Valid until {formatDate(voucher.expiresAt)}</span>
          <span className={`rounded-full px-3 py-0.5 font-semibold ${STATUS_META.AVAILABLE.cls}`}>Available</span>
        </div>
        {br.eligibleNote && <p className="mt-3 text-xs text-charcoal/50">{br.eligibleNote}.</p>}
      </div>
    );
  }

  // 2) Available to claim right now.
  if (br.available) {
    return (
      <div className="overflow-hidden rounded-2xl border-2 border-terracotta bg-gradient-to-br from-oat/70 to-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-3xl">🎂</span>
          <div>
            <p className="font-display text-xl font-bold text-espresso">Happy Birthday!</p>
            <p className="text-sm text-charcoal/70">A free {br.rewardName.toLowerCase()} is waiting for you.</p>
          </div>
        </div>
        {br.eligibleNote && <p className="mt-3 text-sm text-charcoal/60">{br.eligibleNote}.</p>}
        <button
          onClick={claim}
          disabled={claiming}
          className="btn-3d mt-4 w-full rounded-full bg-terracotta px-6 py-3 text-base font-semibold text-cream disabled:opacity-60"
        >
          {claiming ? "Creating your voucher…" : "Claim Birthday Cupcake"}
        </button>
        {br.windowEnd && (
          <p className="mt-2 text-center text-xs text-charcoal/50">Available until {formatDate(br.windowEnd)}</p>
        )}
      </div>
    );
  }

  if (actionableOnly) return null; // banner contexts only show claim/active-voucher states

  // 3) A past voucher (used / expired / cancelled) — show its final state.
  if (voucher) {
    const st = vStatus(voucher);
    const meta = STATUS_META[st];
    return (
      <div className="rounded-2xl border border-oat bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="font-display font-bold text-espresso">🎂 {voucher.rewardName}</p>
          <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${meta.cls}`}>{meta.label}</span>
        </div>
        <p className="mt-1 text-xs text-charcoal/50">
          {voucher.code} · issued {formatDate(voucher.issuedAt)}
          {voucher.usedAt && ` · used ${formatDate(voucher.usedAt)}`}
        </p>
      </div>
    );
  }

  // 4) No voucher yet — explain when/why (only when there's something useful to say).
  if (!br.hasBirthday || br.reason) {
    return (
      <div className="rounded-2xl border border-oat bg-white p-5 shadow-sm">
        <p className="font-display font-bold text-espresso">🎂 Birthday {br.rewardName}</p>
        <p className="mt-1 text-sm text-charcoal/60">
          {!br.hasBirthday
            ? "Add your birthday in Account details to unlock a free cupcake around your birthday each year."
            : br.reason}
        </p>
      </div>
    );
  }

  return null;
}

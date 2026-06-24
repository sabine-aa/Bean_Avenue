import { useEffect, useRef, useState } from "react";
import { COUNTRIES, COUNTRY_BY_ISO, countryFromPhone } from "../lib/countries";

/**
 * Country-code picker + phone number, emitting one combined string
 * ("+961 3478323"). The country picker is a searchable dropdown (200+ countries
 * with flag + name + dial code) so it stays compact while covering everywhere.
 * Fully syncs when the parent prefills the value (e.g. from the saved account).
 */
export function PhoneInput({
  value,
  onChange,
  required,
  id,
}: {
  value: string;
  onChange: (combined: string) => void;
  required?: boolean;
  id?: string;
}) {
  const [iso, setIso] = useState(() => countryFromPhone(value).iso);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  const country = COUNTRY_BY_ISO[iso] ?? COUNTRY_BY_ISO.LB;
  // The local number is whatever follows the dial code in the stored value.
  const localNumber = (() => {
    const compact = (value ?? "").replace(/\s+/g, "");
    return compact.startsWith(country.dial) ? compact.slice(country.dial.length) : compact.replace(/^\+/, "");
  })();

  const emit = (dial: string, n: string) => onChange(`${dial} ${n.trim()}`.trim());

  // If the parent prefills a value whose dial code differs, follow it.
  useEffect(() => {
    const detected = countryFromPhone(value);
    const compact = (value ?? "").replace(/\s+/g, "");
    if (compact.startsWith("+") && detected.dial !== country.dial) setIso(detected.iso);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Close the dropdown on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const filtered = query.trim()
    ? COUNTRIES.filter((c) => {
        const q = query.trim().toLowerCase();
        return c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.iso.toLowerCase() === q;
      })
    : COUNTRIES;

  function pick(nextIso: string) {
    setIso(nextIso);
    setOpen(false);
    setQuery("");
    emit(COUNTRY_BY_ISO[nextIso].dial, localNumber);
  }

  return (
    <div className="flex gap-2" ref={wrapRef}>
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex h-full items-center gap-1 rounded-xl border border-oat bg-white px-3 py-2.5 text-sm font-semibold text-espresso"
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="text-base leading-none">{country.flag}</span>
          <span>{country.dial}</span>
          <span className="text-charcoal/40">▾</span>
        </button>

        {open && (
          <div className="menu-in absolute left-0 z-30 mt-1 w-72 max-w-[80vw] rounded-2xl border border-oat bg-white p-2 shadow-xl">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country or code…"
              className="w-full rounded-xl border border-oat bg-cream/50 px-3 py-2 text-sm"
            />
            <ul role="listbox" className="mt-1 max-h-64 overflow-y-auto">
              {filtered.length === 0 && <li className="px-3 py-2 text-sm text-charcoal/50">No matches.</li>}
              {filtered.map((c) => (
                <li key={c.iso}>
                  <button
                    type="button"
                    onClick={() => pick(c.iso)}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-oat/60 ${
                      c.iso === iso ? "bg-oat/40 font-semibold" : ""
                    }`}
                  >
                    <span className="text-base leading-none">{c.flag}</span>
                    <span className="flex-1 truncate text-espresso">{c.name}</span>
                    <span className="text-charcoal/50">{c.dial}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <input
        id={id}
        type="tel"
        required={required}
        autoComplete="tel"
        inputMode="tel"
        value={localNumber}
        onChange={(e) => emit(country.dial, e.target.value.replace(/[^\d]/g, ""))}
        placeholder="3 478 323"
        className="min-w-0 flex-1 rounded-xl border border-oat bg-white px-4 py-2.5 text-sm"
      />
    </div>
  );
}

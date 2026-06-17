import { FormEvent, useEffect, useState } from "react";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { REWARD_CATEGORIES, type Addon, type AddonGroup, type MenuItem } from "../types";

export function AdminAddons() {
  const toast = useToast();
  const [groups, setGroups] = useState<AddonGroup[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newSel, setNewSel] = useState<"SINGLE" | "MULTIPLE">("MULTIPLE");

  function load() {
    setError(null);
    return api
      .get<AddonGroup[]>("/api/addons/groups")
      .then(setGroups)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load add-ons."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    api.get<MenuItem[]>("/api/menu").then(setMenu).catch(() => {});
  }, []);

  async function createGroup(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await api.post("/api/addons/groups", { name: newName.trim(), selection: newSel });
      setNewName("");
      toast("Group created.");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't create.", "error");
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-espresso">Add-ons</h1>
      <p className="mt-1 text-sm text-charcoal/60">
        Group add-ons (e.g. Milk, Syrup, Extra shots), set prices and limits, and assign each group to
        drinks or whole categories. Size and hot/iced are set by the menu item — not here.
      </p>

      <form onSubmit={createGroup} className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <label className="text-xs font-semibold text-espresso">
          New group name
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Milk Options"
            className="mt-1 block w-52 rounded-lg border border-oat px-3 py-2 font-normal"
          />
        </label>
        <label className="text-xs font-semibold text-espresso">
          Customers can choose
          <select
            value={newSel}
            onChange={(e) => setNewSel(e.target.value as "SINGLE" | "MULTIPLE")}
            className="mt-1 block rounded-lg border border-oat px-3 py-2 font-normal"
          >
            <option value="MULTIPLE">Multiple options</option>
            <option value="SINGLE">One option only</option>
          </select>
        </label>
        <button type="submit" className="rounded-full bg-espresso px-5 py-2 text-sm font-semibold text-cream hover:bg-mocha">
          + Add group
        </button>
      </form>

      {loading ? (
        <p className="mt-6 text-charcoal/60">Loading add-ons…</p>
      ) : error ? (
        <div className="mt-6 rounded-2xl bg-terracotta/10 p-6 text-center">
          <p className="font-semibold text-terracotta-dark">{error}</p>
          <button onClick={() => load()} className="mt-3 rounded-full bg-espresso px-5 py-2 text-sm font-semibold text-cream">
            Retry
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {groups.length === 0 && (
            <p className="rounded-2xl bg-white p-8 text-center text-charcoal/60 shadow-sm">
              No add-on groups yet — create your first one above.
            </p>
          )}
          {groups.map((g) => (
            <GroupCard key={g.id} group={g} menu={menu} reload={load} toast={toast} />
          ))}
        </div>
      )}
    </div>
  );
}

function GroupCard({
  group,
  menu,
  reload,
  toast,
}: {
  group: AddonGroup;
  menu: MenuItem[];
  reload: () => void;
  toast: (m: string, t?: "success" | "error") => void;
}) {
  const [open, setOpen] = useState(false);
  const [aName, setAName] = useState("");
  const [aPrice, setAPrice] = useState(0.5);
  const [aMax, setAMax] = useState(1);
  const [assignVal, setAssignVal] = useState("");

  const patchGroup = async (data: Record<string, unknown>) => {
    try {
      await api.patch(`/api/addons/groups/${group.id}`, data);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save.", "error");
    }
  };
  const deleteGroup = async () => {
    if (!confirm(`Delete "${group.name}" and all its options?`)) return;
    await api.delete(`/api/addons/groups/${group.id}`);
    toast("Group deleted.");
    reload();
  };
  const addAddon = async (e: FormEvent) => {
    e.preventDefault();
    if (!aName.trim()) return;
    await api.post(`/api/addons/groups/${group.id}/addons`, { name: aName.trim(), price: aPrice, maxQuantity: aMax });
    setAName("");
    setAPrice(0.5);
    setAMax(1);
    reload();
  };
  const patchAddon = async (a: Addon, data: Record<string, unknown>) => {
    await api.patch(`/api/addons/${a.id}`, data);
    reload();
  };
  const deleteAddon = async (a: Addon) => {
    await api.delete(`/api/addons/${a.id}`);
    reload();
  };
  const assign = async () => {
    if (!assignVal) return;
    const i = assignVal.indexOf(":");
    const type = assignVal.slice(0, i);
    const rest = assignVal.slice(i + 1);
    const body = type === "cat" ? { groupId: group.id, category: rest } : { groupId: group.id, menuItemId: Number(rest) };
    await api.post("/api/addons/assignments", body);
    setAssignVal("");
    reload();
  };
  const unassign = async (id: number) => {
    await api.delete(`/api/addons/assignments/${id}`);
    reload();
  };

  const menuName = (id: number | null) => menu.find((m) => m.id === id)?.name ?? `#${id}`;
  const assignments = group.assignments ?? [];

  return (
    <div className={`rounded-2xl bg-white p-5 shadow-sm ${group.isAvailable ? "" : "opacity-70"}`}>
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-display text-xl font-bold text-espresso">{group.name}</span>
          <span className="rounded-full bg-oat px-2.5 py-0.5 text-xs font-semibold text-charcoal/70">
            {group.selection === "SINGLE" ? "Choose one" : "Choose multiple"}
          </span>
          <span className="text-xs text-charcoal/50">
            {group.addons.length} option{group.addons.length === 1 ? "" : "s"}
            {assignments.length > 0 && ` · on ${assignments.length} place${assignments.length === 1 ? "" : "s"}`}
          </span>
          {!group.isAvailable && <span className="text-xs font-semibold text-terracotta-dark">disabled</span>}
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <button onClick={() => setOpen((v) => !v)} className="rounded-full bg-espresso px-3 py-1 font-semibold text-cream hover:bg-mocha">
            {open ? "Close" : "Manage"}
          </button>
          <button onClick={() => patchGroup({ isAvailable: !group.isAvailable })} className="rounded-full bg-oat px-3 py-1 font-semibold hover:bg-espresso hover:text-cream">
            {group.isAvailable ? "Disable" : "Enable"}
          </button>
          <button onClick={deleteGroup} className="rounded-full bg-terracotta/15 px-3 py-1 font-semibold text-terracotta-dark hover:bg-terracotta hover:text-cream">
            Delete
          </button>
        </div>
      </div>

      {/* Collapsed preview of options */}
      {!open && group.addons.length > 0 && (
        <p className="mt-2 text-sm text-charcoal/60">
          {group.addons.map((a) => `${a.name}${a.price > 0 ? ` +$${a.price.toFixed(2)}` : " (free)"}`).join(" · ")}
        </p>
      )}

      {open && (
        <div className="mt-4 space-y-5">
          {/* Group settings */}
          <section className="rounded-xl border border-oat p-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-charcoal/50">Group settings</h3>
            <div className="mt-2 flex flex-wrap items-end gap-4">
              <label className="text-xs font-semibold text-espresso">
                Name
                <input
                  defaultValue={group.name}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== group.name && patchGroup({ name: e.target.value.trim() })}
                  className="mt-1 block w-52 rounded-lg border border-oat px-3 py-2 font-normal"
                />
              </label>
              <label className="text-xs font-semibold text-espresso">
                Selection
                <select
                  value={group.selection}
                  onChange={(e) => patchGroup({ selection: e.target.value })}
                  className="mt-1 block rounded-lg border border-oat px-3 py-2 font-normal"
                >
                  <option value="MULTIPLE">Choose multiple</option>
                  <option value="SINGLE">Choose one</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-espresso">
                Min selections
                <input
                  type="number"
                  min={0}
                  defaultValue={group.minSelect}
                  onBlur={(e) => Number(e.target.value) !== group.minSelect && patchGroup({ minSelect: Number(e.target.value) })}
                  className="mt-1 block w-20 rounded-lg border border-oat px-3 py-2 font-normal"
                />
              </label>
              <label className="text-xs font-semibold text-espresso">
                Max selections <span className="font-normal text-charcoal/40">(0 = no limit)</span>
                <input
                  type="number"
                  min={0}
                  defaultValue={group.maxSelect}
                  disabled={group.selection === "SINGLE"}
                  onBlur={(e) => Number(e.target.value) !== group.maxSelect && patchGroup({ maxSelect: Number(e.target.value) })}
                  className="mt-1 block w-20 rounded-lg border border-oat px-3 py-2 font-normal disabled:bg-oat/40"
                />
              </label>
            </div>
          </section>

          {/* Options */}
          <section className="rounded-xl border border-oat p-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-charcoal/50">Options</h3>
            <div className="mt-2 space-y-2">
              {group.addons.map((a) => (
                <div key={a.id} className={`flex flex-wrap items-center gap-2 rounded-xl bg-oat/30 px-3 py-2 ${a.isAvailable ? "" : "opacity-60"}`}>
                  <input
                    defaultValue={a.name}
                    onBlur={(e) => e.target.value.trim() && e.target.value !== a.name && patchAddon(a, { name: e.target.value.trim() })}
                    className="flex-1 rounded-lg border border-oat px-2 py-1 text-sm font-medium"
                  />
                  <label className="text-xs text-charcoal/60">
                    +$
                    <input
                      type="number" step="0.25" min={0}
                      defaultValue={a.price}
                      onBlur={(e) => Number(e.target.value) !== a.price && patchAddon(a, { price: Number(e.target.value) })}
                      className="ml-1 w-16 rounded-lg border border-oat px-2 py-1"
                    />
                  </label>
                  <label className="text-xs text-charcoal/60" title="Max quantity per order (e.g. up to 3 shots)">
                    max qty
                    <input
                      type="number" min={1}
                      defaultValue={a.maxQuantity}
                      onBlur={(e) => Number(e.target.value) !== a.maxQuantity && patchAddon(a, { maxQuantity: Number(e.target.value) })}
                      className="ml-1 w-14 rounded-lg border border-oat px-2 py-1"
                    />
                  </label>
                  <button onClick={() => patchAddon(a, { isAvailable: !a.isAvailable })} className="rounded-full bg-white px-3 py-1 text-xs font-semibold hover:bg-espresso hover:text-cream">
                    {a.isAvailable ? "Available" : "Unavailable"}
                  </button>
                  <button onClick={() => deleteAddon(a)} className="rounded-full px-2 py-1 text-xs font-semibold text-charcoal/40 hover:text-terracotta-dark">
                    ✕
                  </button>
                </div>
              ))}
              {group.addons.length === 0 && <p className="text-xs text-charcoal/50">No options yet — add one below.</p>}

              <form onSubmit={addAddon} className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-oat px-3 py-2">
                <input value={aName} onChange={(e) => setAName(e.target.value)} placeholder="Option name (e.g. Oat milk)" className="flex-1 rounded-lg border border-oat px-2 py-1 text-sm" />
                <label className="text-xs text-charcoal/60">
                  +$<input type="number" step="0.25" min={0} value={aPrice} onChange={(e) => setAPrice(Number(e.target.value))} className="ml-1 w-16 rounded-lg border border-oat px-2 py-1" />
                </label>
                <label className="text-xs text-charcoal/60">
                  max qty<input type="number" min={1} value={aMax} onChange={(e) => setAMax(Number(e.target.value))} className="ml-1 w-14 rounded-lg border border-oat px-2 py-1" />
                </label>
                <button type="submit" className="rounded-full bg-espresso px-4 py-1 text-xs font-semibold text-cream hover:bg-mocha">
                  + Add option
                </button>
              </form>
            </div>
          </section>

          {/* Assignments */}
          <section className="rounded-xl border border-oat p-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-charcoal/50">Assign to items & categories</h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {assignments.length === 0 && <span className="text-xs text-charcoal/50">Not assigned yet — pick a category or drink.</span>}
              {assignments.map((as) => (
                <span key={as.id} className="flex items-center gap-1 rounded-full bg-sage/15 px-3 py-1 text-xs font-semibold text-sage-dark">
                  {as.category ? `📁 ${as.category}` : `🥤 ${menuName(as.menuItemId)}`}
                  <button onClick={() => unassign(as.id)} className="text-sage-dark/60 hover:text-terracotta-dark" aria-label="Remove assignment">✕</button>
                </span>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <select value={assignVal} onChange={(e) => setAssignVal(e.target.value)} className="rounded-lg border border-oat px-3 py-1.5 text-sm">
                <option value="">Assign to…</option>
                <optgroup label="Whole category">
                  {REWARD_CATEGORIES.map((c) => (
                    <option key={c} value={`cat:${c}`}>{c}</option>
                  ))}
                </optgroup>
                <optgroup label="Single drink">
                  {menu.map((m) => (
                    <option key={m.id} value={`item:${m.id}`}>{m.name}</option>
                  ))}
                </optgroup>
              </select>
              <button onClick={assign} disabled={!assignVal} className="rounded-full bg-oat px-4 py-1.5 text-sm font-semibold hover:bg-espresso hover:text-cream disabled:opacity-50">
                Assign
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

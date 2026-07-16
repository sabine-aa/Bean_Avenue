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
    api
      .get<MenuItem[]>("/api/menu")
      .then(setMenu)
      .catch(() => {});
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
      <h1 className="font-display text-espresso text-3xl font-bold">Add-ons</h1>
      <p className="text-charcoal/60 mt-1 text-sm">
        Group add-ons (e.g. Milk, Syrup, Extra shots), set prices and limits, and assign each group to drinks or whole categories. Size and hot/iced are set by
        the menu item — not here.
      </p>

      <form onSubmit={createGroup} className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <label className="text-espresso text-xs font-semibold">
          New group name
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Milk Options"
            className="border-oat mt-1 block w-52 rounded-lg border px-3 py-2 font-normal"
          />
        </label>
        <label className="text-espresso text-xs font-semibold">
          Customers can choose
          <select
            value={newSel}
            onChange={(e) => setNewSel(e.target.value as "SINGLE" | "MULTIPLE")}
            className="border-oat mt-1 block rounded-lg border px-3 py-2 font-normal"
          >
            <option value="MULTIPLE">Multiple options</option>
            <option value="SINGLE">One option only</option>
          </select>
        </label>
        <button type="submit" className="bg-espresso text-cream hover:bg-mocha rounded-full px-5 py-2 text-sm font-semibold">
          + Add group
        </button>
      </form>

      {loading ? (
        <p className="text-charcoal/60 mt-6">Loading add-ons…</p>
      ) : error ? (
        <div className="bg-terracotta/10 mt-6 rounded-2xl p-6 text-center">
          <p className="text-terracotta-dark font-semibold">{error}</p>
          <button onClick={() => load()} className="bg-espresso text-cream mt-3 rounded-full px-5 py-2 text-sm font-semibold">
            Retry
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {groups.length === 0 && (
            <p className="text-charcoal/60 rounded-2xl bg-white p-8 text-center shadow-sm">No add-on groups yet — create your first one above.</p>
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
          <span className="font-display text-espresso text-xl font-bold">{group.name}</span>
          <span className="bg-oat text-charcoal/70 rounded-full px-2.5 py-0.5 text-xs font-semibold">
            {group.selection === "SINGLE" ? "Choose one" : "Choose multiple"}
          </span>
          <span className="text-charcoal/50 text-xs">
            {group.addons.length} option{group.addons.length === 1 ? "" : "s"}
            {assignments.length > 0 && ` · on ${assignments.length} place${assignments.length === 1 ? "" : "s"}`}
          </span>
          {!group.isAvailable && <span className="text-terracotta-dark text-xs font-semibold">disabled</span>}
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <button onClick={() => setOpen((v) => !v)} className="bg-espresso text-cream hover:bg-mocha rounded-full px-3 py-1 font-semibold">
            {open ? "Close" : "Manage"}
          </button>
          <button
            onClick={() => patchGroup({ isAvailable: !group.isAvailable })}
            className="bg-oat hover:bg-espresso hover:text-cream rounded-full px-3 py-1 font-semibold"
          >
            {group.isAvailable ? "Disable" : "Enable"}
          </button>
          <button
            onClick={deleteGroup}
            className="bg-terracotta/15 text-terracotta-dark hover:bg-terracotta hover:text-cream rounded-full px-3 py-1 font-semibold"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Collapsed preview of options */}
      {!open && group.addons.length > 0 && (
        <p className="text-charcoal/60 mt-2 text-sm">
          {group.addons.map((a) => `${a.name}${a.price > 0 ? ` +$${a.price.toFixed(2)}` : " (free)"}`).join(" · ")}
        </p>
      )}

      {open && (
        <div className="mt-4 space-y-5">
          {/* Group settings */}
          <section className="border-oat rounded-xl border p-4">
            <h3 className="text-charcoal/50 text-xs font-bold tracking-wide uppercase">Group settings</h3>
            <div className="mt-2 flex flex-wrap items-end gap-4">
              <label className="text-espresso text-xs font-semibold">
                Name
                <input
                  defaultValue={group.name}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== group.name && patchGroup({ name: e.target.value.trim() })}
                  className="border-oat mt-1 block w-52 rounded-lg border px-3 py-2 font-normal"
                />
              </label>
              <label className="text-espresso text-xs font-semibold">
                Selection
                <select
                  value={group.selection}
                  onChange={(e) => patchGroup({ selection: e.target.value })}
                  className="border-oat mt-1 block rounded-lg border px-3 py-2 font-normal"
                >
                  <option value="MULTIPLE">Choose multiple</option>
                  <option value="SINGLE">Choose one</option>
                </select>
              </label>
              <label className="text-espresso text-xs font-semibold">
                Min selections
                <input
                  type="number"
                  min={0}
                  defaultValue={group.minSelect}
                  onBlur={(e) => Number(e.target.value) !== group.minSelect && patchGroup({ minSelect: Number(e.target.value) })}
                  className="border-oat mt-1 block w-20 rounded-lg border px-3 py-2 font-normal"
                />
              </label>
              <label className="text-espresso text-xs font-semibold">
                Max selections <span className="text-charcoal/40 font-normal">(0 = no limit)</span>
                <input
                  type="number"
                  min={0}
                  defaultValue={group.maxSelect}
                  disabled={group.selection === "SINGLE"}
                  onBlur={(e) => Number(e.target.value) !== group.maxSelect && patchGroup({ maxSelect: Number(e.target.value) })}
                  className="border-oat disabled:bg-oat/40 mt-1 block w-20 rounded-lg border px-3 py-2 font-normal"
                />
              </label>
            </div>
          </section>

          {/* Options */}
          <section className="border-oat rounded-xl border p-4">
            <h3 className="text-charcoal/50 text-xs font-bold tracking-wide uppercase">Options</h3>
            <div className="mt-2 space-y-2">
              {group.addons.map((a) => (
                <div key={a.id} className={`bg-oat/30 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 ${a.isAvailable ? "" : "opacity-60"}`}>
                  <input
                    defaultValue={a.name}
                    onBlur={(e) => e.target.value.trim() && e.target.value !== a.name && patchAddon(a, { name: e.target.value.trim() })}
                    className="border-oat flex-1 rounded-lg border px-2 py-1 text-sm font-medium"
                  />
                  <label className="text-charcoal/60 text-xs">
                    +$
                    <input
                      type="number"
                      step="0.25"
                      min={0}
                      defaultValue={a.price}
                      onBlur={(e) => Number(e.target.value) !== a.price && patchAddon(a, { price: Number(e.target.value) })}
                      className="border-oat ml-1 w-16 rounded-lg border px-2 py-1"
                    />
                  </label>
                  <label className="text-charcoal/60 text-xs" title="Max quantity per order (e.g. up to 3 shots)">
                    max qty
                    <input
                      type="number"
                      min={1}
                      defaultValue={a.maxQuantity}
                      onBlur={(e) => Number(e.target.value) !== a.maxQuantity && patchAddon(a, { maxQuantity: Number(e.target.value) })}
                      className="border-oat ml-1 w-14 rounded-lg border px-2 py-1"
                    />
                  </label>
                  <button
                    onClick={() => patchAddon(a, { isAvailable: !a.isAvailable })}
                    className="hover:bg-espresso hover:text-cream rounded-full bg-white px-3 py-1 text-xs font-semibold"
                  >
                    {a.isAvailable ? "Available" : "Unavailable"}
                  </button>
                  <button onClick={() => deleteAddon(a)} className="text-charcoal/40 hover:text-terracotta-dark rounded-full px-2 py-1 text-xs font-semibold">
                    ✕
                  </button>
                </div>
              ))}
              {group.addons.length === 0 && <p className="text-charcoal/50 text-xs">No options yet — add one below.</p>}

              <form onSubmit={addAddon} className="border-oat flex flex-wrap items-center gap-2 rounded-xl border border-dashed px-3 py-2">
                <input
                  value={aName}
                  onChange={(e) => setAName(e.target.value)}
                  placeholder="Option name (e.g. Oat milk)"
                  className="border-oat flex-1 rounded-lg border px-2 py-1 text-sm"
                />
                <label className="text-charcoal/60 text-xs">
                  +$
                  <input
                    type="number"
                    step="0.25"
                    min={0}
                    value={aPrice}
                    onChange={(e) => setAPrice(Number(e.target.value))}
                    className="border-oat ml-1 w-16 rounded-lg border px-2 py-1"
                  />
                </label>
                <label className="text-charcoal/60 text-xs">
                  max qty
                  <input
                    type="number"
                    min={1}
                    value={aMax}
                    onChange={(e) => setAMax(Number(e.target.value))}
                    className="border-oat ml-1 w-14 rounded-lg border px-2 py-1"
                  />
                </label>
                <button type="submit" className="bg-espresso text-cream hover:bg-mocha rounded-full px-4 py-1 text-xs font-semibold">
                  + Add option
                </button>
              </form>
            </div>
          </section>

          {/* Assignments */}
          <section className="border-oat rounded-xl border p-4">
            <h3 className="text-charcoal/50 text-xs font-bold tracking-wide uppercase">Assign to items & categories</h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {assignments.length === 0 && <span className="text-charcoal/50 text-xs">Not assigned yet — pick a category or drink.</span>}
              {assignments.map((as) => (
                <span key={as.id} className="bg-sage/15 text-sage-dark flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold">
                  {as.category ? `📁 ${as.category}` : `🥤 ${menuName(as.menuItemId)}`}
                  <button onClick={() => unassign(as.id)} className="text-sage-dark/60 hover:text-terracotta-dark" aria-label="Remove assignment">
                    ✕
                  </button>
                </span>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <select value={assignVal} onChange={(e) => setAssignVal(e.target.value)} className="border-oat rounded-lg border px-3 py-1.5 text-sm">
                <option value="">Assign to…</option>
                <optgroup label="Whole category">
                  {REWARD_CATEGORIES.map((c) => (
                    <option key={c} value={`cat:${c}`}>
                      {c}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Single drink">
                  {menu.map((m) => (
                    <option key={m.id} value={`item:${m.id}`}>
                      {m.name}
                    </option>
                  ))}
                </optgroup>
              </select>
              <button
                onClick={assign}
                disabled={!assignVal}
                className="bg-oat hover:bg-espresso hover:text-cream rounded-full px-4 py-1.5 text-sm font-semibold disabled:opacity-50"
              >
                Assign
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

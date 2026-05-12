import { useEffect, useState, useCallback } from "react";
import {
  collection, query, getDocs, updateDoc, doc,
  serverTimestamp, orderBy
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { Plus, Pencil, X, Trash2 } from "lucide-react";
import Layout from "../../components/layout/Layout";

const DAYS = ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"];
const DAY_SHORT = { MONDAY:"Mon", TUESDAY:"Tue", WEDNESDAY:"Wed", THURSDAY:"Thu", FRIDAY:"Fri", SATURDAY:"Sat", SUNDAY:"Sun" };
const PERIODS = ["BREAKFAST","LUNCH","SUPPER"];
const PERIOD_LABEL = { BREAKFAST:"Breakfast", LUNCH:"Lunch", SUPPER:"Supper" };
const PERIOD_TIME  = { BREAKFAST:"6:00 am",   LUNCH:"12:00 pm", SUPPER:"5:00 pm" };
const PERIOD_COLOR = {
  BREAKFAST: { bg: "bg-amber-50",  border: "border-amber-200", dot: "bg-amber-400" },
  LUNCH:     { bg: "bg-blue-50",   border: "border-blue-200",  dot: "bg-blue-400"  },
  SUPPER:    { bg: "bg-violet-50", border: "border-violet-200",dot: "bg-violet-400"},
};
const CATEGORIES = ["MAIN","SIDE","DRINK"];

function emptyItem() { return { name: "", category: "MAIN" }; }

export default function MealMenusPage() {
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState("MONDAY");

  // Edit modal state
  const [editing, setEditing] = useState(null);
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "mealMenus"), orderBy("dayOfWeek"), orderBy("mealPeriod")));
      setMenus(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openEdit(menu) {
    setEditing(menu);
    setItems(menu.items?.length ? menu.items.map(i => ({ ...i })) : [emptyItem()]);
  }

  function closeEdit() { setEditing(null); setItems([]); }

  function updateItem(idx, field, val) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  }

  async function handleSave(e) {
    e.preventDefault();
    const cleaned = items.filter(i => i.name.trim());
    if (!cleaned.length) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "mealMenus", editing.id), { items: cleaned, updatedAt: serverTimestamp() });
      setMenus(prev => prev.map(m => m.id === editing.id ? { ...m, items: cleaned } : m));
      closeEdit();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }


  function openEdit(m) {
    setEditing(m);
    setForm({ dayOfWeek: m.dayOfWeek, mealPeriod: m.mealPeriod, patientClass: m.patientClass, title: m.title || "", items: m.items?.length ? m.items : [emptyItem()], isActive: m.isActive !== false });
    setShowModal(true);
  }

  async function handleDelete(m) {
    if (!confirm(`Delete menu for ${m.dayOfWeek} ${m.mealPeriod} (${m.patientClass})?`)) return;
    await deleteDoc(doc(db, "mealMenus", m.id));
    load();
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, items: form.items.filter(i => i.name.trim()), updatedAt: serverTimestamp() };
      if (editing) {
        await updateDoc(doc(db, "mealMenus", editing.id), payload);
      } else {
        await addDoc(collection(db, "mealMenus"), { ...payload, createdAt: serverTimestamp(), createdBy: userProfile?.uid || "" });
      }
      setShowModal(false);
      load();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  // Get the 3 menus for the selected day (one per period)
  const dayMenus = PERIODS.map(p => menus.find(m => m.dayOfWeek === day && m.mealPeriod === p) || null);

  return (
    <Layout>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-slate-900">Weekly Meal Menu</h1>
          <p className="text-sm text-slate-500">
            UGMC standard menu — click <strong>Edit</strong> on any meal to update its food items.
          </p>
        </div>

        {/* Day tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {DAYS.map(d => (
            <button key={d} onClick={() => setDay(d)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                day === d ? "bg-primary-600 text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}>
              {DAY_SHORT[d]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-slate-400 text-sm py-12">Loading menus…</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {PERIODS.map((period, idx) => {
              const menu = dayMenus[idx];
              const c = PERIOD_COLOR[period];
              const mains  = menu?.items?.filter(i => i.category === "MAIN")  || [];
              const sides  = menu?.items?.filter(i => i.category === "SIDE")  || [];
              const drinks = menu?.items?.filter(i => i.category === "DRINK") || [];

              return (
                <div key={period} className={`rounded-xl border ${c.border} ${c.bg} overflow-hidden flex flex-col`}>
                  {/* Card header */}
                  <div className={`flex items-center justify-between px-4 py-3 border-b ${c.border}`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                      <span className="font-semibold text-slate-800">{PERIOD_LABEL[period]}</span>
                      <span className="text-xs text-slate-400">{PERIOD_TIME[period]}</span>
                    </div>
                    {menu && (
                      <button onClick={() => openEdit(menu)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-slate-600 hover:bg-white hover:text-primary-600 transition-colors border border-transparent hover:border-slate-200">
                        <Pencil size={12} /> Edit
                      </button>
                    )}
                  </div>

                  {/* Card body */}
                  <div className="px-4 py-3 flex-1 space-y-3">
                    {!menu ? (
                      <p className="text-sm text-slate-400 italic">No menu configured.</p>
                    ) : (
                      <>
                        {mains.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                              Options (nurse selects 1 per patient)
                            </p>
                            <ol className="space-y-1.5">
                              {mains.map((item, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-slate-800">
                                  <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-white border border-slate-300 flex items-center justify-center text-xs font-bold text-slate-500">
                                    {i + 1}
                                  </span>
                                  {item.name}
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}
                        {(sides.length > 0 || drinks.length > 0) && (
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                              Included with every meal
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {[...sides, ...drinks].map((item, i) => (
                                <span key={i} className="px-2 py-0.5 bg-white border border-slate-200 rounded-full text-xs text-slate-600">
                                  {item.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {menu && (
                    <div className={`px-4 py-2 border-t ${c.border} text-xs text-slate-400`}>
                      {mains.length} option{mains.length !== 1 ? "s" : ""} · {sides.length + drinks.length} included items
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* VIP note */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-sm">V</div>
          <div>
            <p className="text-sm font-semibold text-amber-800">VIP / VVIP patients (Private Ward, Cardio Thoracic)</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Receive the same main course options above, <strong>plus</strong> a choice of appetiser (A1–A5) and
              dessert (D1–D7) from the Mayrit VIP Food Menu board. To update those items, go to{" "}
              <strong>Meal Settings</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* ── Edit Modal ───────────────────────────────────────────────────── */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h2 className="font-semibold text-slate-900">
                  Edit — {editing.dayOfWeek[0] + editing.dayOfWeek.slice(1).toLowerCase()} {PERIOD_LABEL[editing.mealPeriod]}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  MAIN items appear as numbered choices for nurses. SIDE and DRINK are included automatically.
                </p>
              </div>
              <button onClick={closeEdit} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto">
              <div className="px-5 py-4 space-y-2">
                <div className="grid grid-cols-[1fr_140px_32px] gap-2 px-1">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Food Item</span>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Category</span>
                  <span />
                </div>

                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_140px_32px] gap-2 items-center">
                    <input
                      value={item.name}
                      onChange={e => updateItem(idx, "name", e.target.value)}
                      placeholder="e.g. Jollof Rice & Grilled Chicken"
                      className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <select
                      value={item.category}
                      onChange={e => updateItem(idx, "category", e.target.value)}
                      className="border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                      <option value="MAIN">Main (choice)</option>
                      <option value="SIDE">Side (included)</option>
                      <option value="DRINK">Drink (included)</option>
                    </select>
                    <button type="button" onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}

                <button type="button" onClick={() => setItems(prev => [...prev, emptyItem()])}
                  className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium mt-1">
                  <Plus size={14} /> Add food item
                </button>
              </div>

              <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100">
                <button type="button" onClick={closeEdit}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-sm">
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}


        {/* Day tabs */}
        <div className="flex overflow-x-auto gap-1 pb-1">
          {DAYS.map(d => (
            <button key={d} onClick={() => setDayFilter(d)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dayFilter === d ? "bg-primary-600 text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              {d[0] + d.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Period filter */}
        <div className="flex gap-2">
          {["ALL", ...PERIODS].map(p => (
            <button key={p} onClick={() => setPeriodFilter(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${periodFilter === p ? "bg-slate-800 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              {p === "ALL" ? "All Periods" : p[0] + p.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Menu cards */}
        {loading ? (
          <div className="text-center text-slate-400 text-sm py-8">Loading menus…</div>
        ) : displayed.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <p className="text-slate-500 text-sm">No menus configured for {dayFilter}.</p>
            <button onClick={openAdd} className="mt-3 text-sm text-primary-600 hover:underline">Add a menu →</button>
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map(m => (
              <div key={m.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}
                >
                  <button className="text-slate-400">
                    {expandedId === m.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PERIOD_COLORS[m.mealPeriod] || "bg-slate-100 text-slate-600"}`}>{m.mealPeriod}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CLASS_COLORS[m.patientClass] || "bg-slate-100 text-slate-600"}`}>{m.patientClass}</span>
                  {m.title && <span className="text-sm text-slate-700 font-medium">{m.title}</span>}
                  <span className="text-xs text-slate-400 ml-auto">{(m.items || []).length} items</span>
                  <span className={`w-2 h-2 rounded-full ${m.isActive !== false ? "bg-green-400" : "bg-slate-300"}`} />
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <button onClick={() => openEdit(m)} className="p-1.5 rounded text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"><Pencil size={13} /></button>
                    <button onClick={() => handleDelete(m)} className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>
                  </div>
                </div>
                {expandedId === m.id && (
                  <div className="border-t border-slate-100 px-4 py-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {["MAIN","APPETISER","DESSERT","DRINK","SIDE","SPECIAL"].map(cat => {
                        const catItems = (m.items || []).filter(i => i.category === cat);
                        if (!catItems.length) return null;
                        return (
                          <div key={cat}>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{cat}</p>
                            <ul className="space-y-1">
                              {catItems.map((item, i) => (
                                <li key={i} className="text-sm text-slate-700 flex items-center justify-between">
                                  <span>{item.name}</span>
                                  {item.price > 0 && <span className="text-xs text-slate-400">GH₵{item.price.toFixed(2)}</span>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="font-semibold text-slate-800">{editing ? "Edit Menu" : "Add Menu"}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={16} /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Day *</label>
                  <select value={form.dayOfWeek} onChange={e => setForm(f => ({ ...f, dayOfWeek: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                    {DAYS.map(d => <option key={d} value={d}>{d[0] + d.slice(1).toLowerCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Meal Period *</label>
                  <select value={form.mealPeriod} onChange={e => setForm(f => ({ ...f, mealPeriod: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                    {PERIODS.map(p => <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Patient Class *</label>
                  <select value={form.patientClass} onChange={e => setForm(f => ({ ...f, patientClass: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                    {PATIENT_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Title (optional)</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Monday Breakfast — General"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Menu Items</label>
                  <button type="button" onClick={() => setForm(f => ({ ...f, items: [...f.items, emptyItem()] }))}
                    className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                    <Plus size={12} /> Add item
                  </button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {form.items.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 flex-1">
                        <input value={item.name} onChange={e => updateItem(idx, "name", e.target.value)}
                          placeholder="Item name *"
                          className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500" />
                        <select value={item.category} onChange={e => updateItem(idx, "category", e.target.value)}
                          className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500">
                          {ITEM_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <input type="number" value={item.price} onChange={e => updateItem(idx, "price", parseFloat(e.target.value) || 0)}
                          placeholder="Price"
                          className="w-20 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500" />
                      </div>
                      <button type="button" onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))}
                        className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors mt-0.5">
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="menuActive" checked={form.isActive}
                  onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                  className="rounded border-slate-300 text-primary-600" />
                <label htmlFor="menuActive" className="text-sm text-slate-700">Active (visible to nurses)</label>
              </div>

              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-60 transition-colors">
                  {saving ? "Saving…" : editing ? "Save Changes" : "Add Menu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}

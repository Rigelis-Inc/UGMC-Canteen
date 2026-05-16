import { useEffect, useState, useCallback } from "react";
import {
  collection, query, getDocs, updateDoc, doc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { Plus, Pencil, X, Trash2, Crown } from "lucide-react";
import { Link } from "react-router-dom";

const DAYS = ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"];
const DAY_SHORT = { MONDAY:"Mon", TUESDAY:"Tue", WEDNESDAY:"Wed", THURSDAY:"Thu", FRIDAY:"Fri", SATURDAY:"Sat", SUNDAY:"Sun" };
const PERIODS = ["BREAKFAST","LUNCH","SUPPER"];
const PERIOD_LABEL = { BREAKFAST:"Breakfast", LUNCH:"Lunch", SUPPER:"Supper" };
const PERIOD_TIME  = { BREAKFAST:"6:00 am",   LUNCH:"12:00 pm", SUPPER:"5:00 pm" };
const PERIOD_COLOR = {
  BREAKFAST: { accent: "bg-amber-400",  dot: "bg-amber-400",  tag: "text-amber-600 bg-amber-50"  },
  LUNCH:     { accent: "bg-blue-400",   dot: "bg-blue-400",   tag: "text-blue-600 bg-blue-50"    },
  SUPPER:    { accent: "bg-violet-400", dot: "bg-violet-400", tag: "text-violet-600 bg-violet-50" },
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
      const snap = await getDocs(query(collection(db, "mealMenus")));
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const DAYS_ORDER = ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"];
      const PERIOD_ORDER = ["BREAKFAST","LUNCH","SUPPER"];
      docs.sort((a, b) => {
        const di = DAYS_ORDER.indexOf(a.dayOfWeek) - DAYS_ORDER.indexOf(b.dayOfWeek);
        if (di !== 0) return di;
        return PERIOD_ORDER.indexOf(a.mealPeriod) - PERIOD_ORDER.indexOf(b.mealPeriod);
      });
      setMenus(docs);
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


  // Get the 3 menus for the selected day (one per period)
  const dayMenus = PERIODS.map(p => menus.find(m => m.dayOfWeek === day && m.mealPeriod === p) || null);

  return (
    <>
      <div className="space-y-5 max-w-5xl">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-slate-900">Weekly Meal Menu</h1>
          <p className="text-sm text-slate-500">
            Mayrit Cuisines standard menu — click <strong>Edit</strong> on any meal to update its food items.
          </p>
        </div>

        {/* Day tabs */}
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map(d => (
            <button key={d} onClick={() => setDay(d)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                day === d ? "bg-primary-600 text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}>
              {DAY_SHORT[d]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-slate-400 text-sm py-12">Loading menus…</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {PERIODS.map((period, idx) => {
              const menu = dayMenus[idx];
              const c = PERIOD_COLOR[period];
              const mains  = menu?.items?.filter(i => i.category === "MAIN")  || [];
              const sides  = menu?.items?.filter(i => i.category === "SIDE")  || [];
              const drinks = menu?.items?.filter(i => i.category === "DRINK") || [];

              return (
                <div key={period} className="rounded-xl bg-white border border-slate-200 overflow-hidden flex flex-col shadow-sm">
                  {/* Accent bar */}
                  <div className={`h-1 w-full ${c.accent}`} />

                  {/* Card header */}
                  <div className="flex items-center justify-between px-5 pt-4 pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                      <span className="font-semibold text-slate-800">{PERIOD_LABEL[period]}</span>
                      <span className="text-xs text-slate-400">{PERIOD_TIME[period]}</span>
                    </div>
                    {menu && (
                      <button onClick={() => openEdit(menu)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors">
                        <Pencil size={11} /> Edit
                      </button>
                    )}
                  </div>

                  <div className="px-5 pb-1"><div className="border-t border-slate-100" /></div>

                  {/* Card body */}
                  <div className="px-5 py-4 flex-1 space-y-5">
                    {!menu ? (
                      <p className="text-sm text-slate-400 italic">No menu configured.</p>
                    ) : (
                      <>
                        {mains.length > 0 && (
                            <ol className="space-y-2.5">
                              {mains.map((item, i) => (
                                <li key={i} className="flex items-start gap-3">
                                  <span className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${c.tag}`}>
                                    {i + 1}
                                  </span>
                                  <span className="text-sm text-slate-700 leading-snug pt-0.5">{item.name}</span>
                              </li>
                            ))}
                          </ol>
                        )}
                        {(sides.length > 0 || drinks.length > 0) && (
                          <div>
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Included</p>
                              <div className="flex flex-wrap gap-2">
                                {[...sides, ...drinks].map((item, i) => (
                                  <span key={i} className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-500">
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
                    <div className="px-5 py-2.5 border-t border-slate-100 text-[11px] text-slate-400">
                      {mains.length} option{mains.length !== 1 ? "s" : ""} · {sides.length + drinks.length} included
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* VIP note */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <Crown size={18} className="flex-shrink-0 text-amber-500" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">VIP / VVIP patients</span> receive the same main options above{" "}
            <strong>plus</strong> a choice of appetiser (A1–A5) and dessert (D1–D7).{" "}
            <Link to="/kitchen/settings" className="underline font-semibold hover:text-amber-900">
              Edit VIP menu in Meal Settings →
            </Link>
          </p>
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
    </>
  );
}

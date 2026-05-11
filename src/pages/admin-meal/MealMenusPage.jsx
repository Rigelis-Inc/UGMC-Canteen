import { useEffect, useState, useCallback } from "react";
import {
  collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, orderBy
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { Plus, Pencil, X, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import Layout from "../../components/layout/Layout";

const DAYS = ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"];
const PERIODS = ["BREAKFAST","LUNCH","SUPPER"];
const PATIENT_CLASSES = ["GENERAL","VIP","VVIP","SPECIAL","PUREE","NG_TUBE"];
const ITEM_CATEGORIES = ["MAIN","APPETISER","DESSERT","DRINK","SIDE","SPECIAL"];

const PERIOD_COLORS = {
  BREAKFAST: "bg-amber-100 text-amber-700",
  LUNCH: "bg-blue-100 text-blue-700",
  SUPPER: "bg-purple-100 text-purple-700",
};

const CLASS_COLORS = {
  GENERAL: "bg-slate-100 text-slate-700",
  VIP: "bg-amber-100 text-amber-700",
  VVIP: "bg-purple-100 text-purple-700",
  SPECIAL: "bg-pink-100 text-pink-700",
  PUREE: "bg-teal-100 text-teal-700",
  NG_TUBE: "bg-red-100 text-red-700",
};

const emptyItem = () => ({ name: "", description: "", category: "MAIN", defaultIncluded: true, price: 0 });

export default function MealMenusPage() {
  const { userProfile } = useAuth();
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dayFilter, setDayFilter] = useState("MONDAY");
  const [periodFilter, setPeriodFilter] = useState("ALL");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const [form, setForm] = useState({
    dayOfWeek: "MONDAY", mealPeriod: "BREAKFAST", patientClass: "GENERAL",
    title: "", items: [emptyItem()], isActive: true,
  });

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

  function openAdd() {
    setEditing(null);
    setForm({ dayOfWeek: dayFilter, mealPeriod: PERIODS[0], patientClass: "GENERAL", title: "", items: [emptyItem()], isActive: true });
    setShowModal(true);
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

  function updateItem(idx, field, value) {
    setForm(f => ({
      ...f,
      items: f.items.map((item, i) => i === idx ? { ...item, [field]: value } : item),
    }));
  }

  const displayed = menus.filter(m =>
    m.dayOfWeek === dayFilter &&
    (periodFilter === "ALL" || m.mealPeriod === periodFilter)
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Meal Menus</h1>
            <p className="text-sm text-slate-500">Manage the hospital's weekly meal menu</p>
          </div>
          <button onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm">
            <Plus size={15} /> Add Menu
          </button>
        </div>

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

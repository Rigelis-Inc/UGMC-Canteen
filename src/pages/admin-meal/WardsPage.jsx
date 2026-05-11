import { useEffect, useState, useCallback } from "react";
import {
  collection, query, getDocs, addDoc, updateDoc, doc, serverTimestamp, orderBy
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { Plus, Pencil, X, Building2, ToggleLeft, ToggleRight } from "lucide-react";
import Layout from "../../components/layout/Layout";

const WARD_CATEGORIES = [
  "GENERAL","EMERGENCY","ICU","PEDIATRIC","OBGYN","SURGERY","SPECIALTY","PRIVATE"
];

export default function WardsPage() {
  const { userProfile } = useAuth();
  const [wards, setWards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", code: "", category: "GENERAL",
    isVipEligible: false, isVvipEligible: false, isActive: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "wards"), orderBy("name")));
      setWards(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditing(null);
    setForm({ name: "", code: "", category: "GENERAL", isVipEligible: false, isVvipEligible: false, isActive: true });
    setShowModal(true);
  }

  function openEdit(w) {
    setEditing(w);
    setForm({
      name: w.name, code: w.code || "", category: w.category || "GENERAL",
      isVipEligible: w.isVipEligible || false, isVvipEligible: w.isVvipEligible || false,
      isActive: w.isActive !== false,
    });
    setShowModal(true);
  }

  async function toggleActive(w) {
    await updateDoc(doc(db, "wards", w.id), { isActive: !w.isActive, updatedAt: serverTimestamp() });
    load();
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, name: form.name.trim(), updatedAt: serverTimestamp() };
      if (editing) {
        await updateDoc(doc(db, "wards", editing.id), payload);
      } else {
        await addDoc(collection(db, "wards"), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: userProfile?.uid || "",
        });
      }
      setShowModal(false);
      load();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Wards / Units</h1>
            <p className="text-sm text-slate-500">Manage hospital wards for patient meal ordering</p>
          </div>
          <button onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm">
            <Plus size={15} /> Add Ward
          </button>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm">Loading wards…</div>
          ) : wards.length === 0 ? (
            <div className="p-8 text-center">
              <Building2 size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-slate-500 text-sm">No wards yet. Add wards to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Ward Name</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Code</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Category</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">VIP</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">VVIP</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {wards.map(w => (
                    <tr key={w.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{w.name}</td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-xs">{w.code || "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{w.category || "GENERAL"}</td>
                      <td className="px-4 py-3">
                        {w.isVipEligible ? <span className="text-amber-600 font-medium text-xs">VIP</span> : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {w.isVvipEligible ? <span className="text-purple-600 font-medium text-xs">VVIP</span> : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${w.isActive !== false ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                          {w.isActive !== false ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEdit(w)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => toggleActive(w)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            title={w.isActive !== false ? "Deactivate" : "Activate"}>
                            {w.isActive !== false ? <ToggleRight size={16} className="text-green-500" /> : <ToggleLeft size={16} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">{editing ? "Edit Ward" : "Add Ward"}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={16} /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ward Name *</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Emergency"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Code</label>
                  <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="e.g. EMRG"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                    {WARD_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={form.isVipEligible}
                    onChange={e => setForm(f => ({ ...f, isVipEligible: e.target.checked }))}
                    className="rounded border-slate-300 text-primary-600" />
                  VIP eligible
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={form.isVvipEligible}
                    onChange={e => setForm(f => ({ ...f, isVvipEligible: e.target.checked }))}
                    className="rounded border-slate-300 text-primary-600" />
                  VVIP eligible
                </label>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-60 transition-colors">
                  {saving ? "Saving…" : editing ? "Save Changes" : "Add Ward"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}

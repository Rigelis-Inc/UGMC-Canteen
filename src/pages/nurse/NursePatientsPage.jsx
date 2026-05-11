import { useEffect, useState, useCallback } from "react";
import {
  collection, query, where, getDocs, addDoc, updateDoc, doc,
  serverTimestamp, orderBy
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { Plus, Pencil, X, Search, UserRound, BedDouble } from "lucide-react";

const PATIENT_CLASSES = ["GENERAL", "VIP", "VVIP"];
const SPECIAL_MEAL_TYPES = ["NONE", "PUREE", "NG_TUBE", "SOFT_DIET", "NO_SALT", "DIABETIC", "OTHER"];

const CLASS_COLORS = {
  GENERAL: "bg-slate-100 text-slate-700",
  VIP: "bg-amber-100 text-amber-700",
  VVIP: "bg-purple-100 text-purple-700",
};

export default function NursePatientsPage() {
  const { userProfile, assignedWards } = useAuth();
  const [patients, setPatients] = useState([]);
  const [wards, setWards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    patientName: "", wardId: "", bedNumber: "", roomNumber: "",
    patientClass: "GENERAL", isSpecialPatient: false,
    specialMealType: "NONE", specialInstructions: "", status: "ADMITTED",
  });

  const loadData = useCallback(async () => {
    if (!userProfile) return;
    setLoading(true);
    try {
      // Load wards this nurse is assigned to
      const wardIds = assignedWards;
      if (wardIds.length > 0) {
        const wSnap = await getDocs(query(collection(db, "wards"), where("isActive", "==", true)));
        const allWards = wSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setWards(allWards.filter(w => wardIds.includes(w.id) || wardIds.includes(w.name)));
      } else {
        // Admin/super admin: show all wards
        const wSnap = await getDocs(query(collection(db, "wards"), where("isActive", "==", true)));
        setWards(wSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      }

      // Load patients
      let pQuery;
      if (assignedWards.length > 0) {
        pQuery = query(collection(db, "patients"),
          where("wardId", "in", assignedWards.slice(0, 10)),
          orderBy("createdAt", "desc"));
      } else {
        pQuery = query(collection(db, "patients"), orderBy("createdAt", "desc"));
      }
      const pSnap = await getDocs(pQuery);
      setPatients(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [userProfile, assignedWards]);

  useEffect(() => { loadData(); }, [loadData]);

  function openAdd() {
    setEditingPatient(null);
    setForm({
      patientName: "", wardId: wards[0]?.id || "", bedNumber: "", roomNumber: "",
      patientClass: "GENERAL", isSpecialPatient: false,
      specialMealType: "NONE", specialInstructions: "", status: "ADMITTED",
    });
    setShowModal(true);
  }

  function openEdit(p) {
    setEditingPatient(p);
    setForm({
      patientName: p.patientName, wardId: p.wardId, bedNumber: p.bedNumber,
      roomNumber: p.roomNumber || "", patientClass: p.patientClass,
      isSpecialPatient: p.isSpecialPatient || false,
      specialMealType: p.specialMealType || "NONE",
      specialInstructions: p.specialInstructions || "", status: p.status,
    });
    setShowModal(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.patientName.trim() || !form.wardId || !form.bedNumber.trim()) return;
    setSaving(true);
    try {
      const ward = wards.find(w => w.id === form.wardId);
      const payload = {
        ...form,
        wardName: ward?.name || "",
        updatedAt: serverTimestamp(),
      };
      if (editingPatient) {
        await updateDoc(doc(db, "patients", editingPatient.id), payload);
      } else {
        await addDoc(collection(db, "patients"), {
          ...payload,
          createdBy: userProfile.uid,
          createdByName: userProfile.fullName || "",
          createdAt: serverTimestamp(),
          dischargedAt: null,
        });
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDischarge(p) {
    if (!confirm(`Discharge ${p.patientName}?`)) return;
    await updateDoc(doc(db, "patients", p.id), {
      status: "DISCHARGED", dischargedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    loadData();
  }

  const filtered = patients.filter(p =>
    p.patientName?.toLowerCase().includes(search.toLowerCase()) ||
    p.bedNumber?.toLowerCase().includes(search.toLowerCase()) ||
    p.wardName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Patients</h1>
          <p className="text-sm text-slate-500">Manage admitted patients in your ward</p>
        </div>
        <button onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm">
          <Plus size={15} /> Add Patient
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search patients by name, bed, ward…"
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading patients…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <UserRound size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-slate-500 text-sm">No patients found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Patient</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Ward / Bed</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Class</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Special</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{p.patientName}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <span>{p.wardName}</span>
                      <span className="mx-1 text-slate-300">·</span>
                      <span className="inline-flex items-center gap-1"><BedDouble size={12} /> {p.bedNumber}</span>
                      {p.roomNumber && <span className="text-xs text-slate-400 ml-1">(Rm {p.roomNumber})</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CLASS_COLORS[p.patientClass] || "bg-slate-100 text-slate-600"}`}>
                        {p.patientClass}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      {p.isSpecialPatient ? (
                        <span className="text-amber-700 font-medium">{p.specialMealType !== "NONE" ? p.specialMealType : "Special"}</span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.status === "ADMITTED" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(p)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors">
                          <Pencil size={13} />
                        </button>
                        {p.status === "ADMITTED" && (
                          <button onClick={() => handleDischarge(p)}
                            className="px-2 py-1 rounded-md text-xs text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors">
                            Discharge
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">{editingPatient ? "Edit Patient" : "Add Patient"}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Patient Name *</label>
                <input required value={form.patientName} onChange={e => setForm(f => ({ ...f, patientName: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ward *</label>
                  <select required value={form.wardId} onChange={e => setForm(f => ({ ...f, wardId: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                    <option value="">Select ward</option>
                    {wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Patient Class *</label>
                  <select value={form.patientClass} onChange={e => setForm(f => ({ ...f, patientClass: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                    {PATIENT_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bed Number *</label>
                  <input required value={form.bedNumber} onChange={e => setForm(f => ({ ...f, bedNumber: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Room Number</label>
                  <input value={form.roomNumber} onChange={e => setForm(f => ({ ...f, roomNumber: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="special" checked={form.isSpecialPatient}
                  onChange={e => setForm(f => ({ ...f, isSpecialPatient: e.target.checked }))}
                  className="rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                <label htmlFor="special" className="text-sm text-slate-700">Special patient / dietary requirement</label>
              </div>
              {form.isSpecialPatient && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Special Meal Type</label>
                    <select value={form.specialMealType} onChange={e => setForm(f => ({ ...f, specialMealType: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                      {SPECIAL_MEAL_TYPES.map(t => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Special Instructions</label>
                    <textarea value={form.specialInstructions} onChange={e => setForm(f => ({ ...f, specialInstructions: e.target.value }))}
                      rows={2} placeholder="e.g. No salt, soft diet only…"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
                  </div>
                </>
              )}
              {editingPatient && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                    {["ADMITTED", "DISCHARGED", "TRANSFERRED"].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-60 transition-colors">
                  {saving ? "Saving…" : editingPatient ? "Save Changes" : "Add Patient"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState, useCallback } from "react";
import {
  collection, query, where, getDocs, addDoc, updateDoc, doc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { Plus, Pencil, X, Search, Crown, LogOut } from "lucide-react";

const PATIENT_CLASSES = ["GENERAL", "VIP", "VVIP"];
const SPECIAL_MEAL_TYPES = ["NONE", "PUREE", "NG_TUBE", "SOFT_DIET", "NO_SALT", "DIABETIC", "OTHER"];
const PATIENT_CLASS_LABELS = {
  GENERAL: "General",
  VIP: "VIP",
  VVIP: "VVIP",
};

const CLASS_AVATAR = {
  GENERAL: "bg-slate-100 text-slate-600",
  VIP: "bg-amber-100 text-amber-700",
  VVIP: "bg-purple-100 text-purple-700",
};

const CLASS_BADGE = {
  GENERAL: "bg-slate-100 text-slate-600 border-transparent",
  VIP: "bg-amber-50 text-amber-800 border-amber-200",
  VVIP: "bg-purple-50 text-purple-800 border-purple-200",
};

const STATUS_BADGE = {
  ADMITTED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  DISCHARGED: "bg-slate-100 text-slate-500 border-slate-200",
  TRANSFERRED: "bg-blue-50 text-blue-700 border-blue-200",
};

function PatientAvatar({ name, patientClass }) {
  return (
    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${CLASS_AVATAR[patientClass] || "bg-slate-100 text-slate-600"}`}>
      {name?.[0]?.toUpperCase() || "P"}
    </div>
  );
}

export default function NursePatientsPage() {
  const { currentUser, userProfile, assignedWards } = useAuth();
  const [patients, setPatients] = useState([]);
  const [wards, setWards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [form, setForm] = useState({
    patientName: "", phone: "", wardId: "", bedNumber: "", roomNumber: "",
    patientClass: "GENERAL", isSpecialPatient: false,
    specialMealType: "NONE", specialInstructions: "", status: "ADMITTED",
  });

  const loadData = useCallback(async () => {
    if (!userProfile) return;
    setLoading(true);
    try {
      const wardIds = assignedWards;
      if (wardIds.length > 0) {
        const wSnap = await getDocs(query(collection(db, "wards"), where("isActive", "==", true)));
        const allWards = wSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setWards(allWards.filter(w => wardIds.includes(w.id) || wardIds.includes(w.name)));
      } else {
        const wSnap = await getDocs(query(collection(db, "wards"), where("isActive", "==", true)));
        setWards(wSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      }

      let pQuery;
      if (assignedWards.length > 0) {
        pQuery = query(collection(db, "patients"),
          where("wardId", "in", assignedWards.slice(0, 10)));
      } else {
        pQuery = query(collection(db, "patients"));
      }
      const pSnap = await getDocs(pQuery);
      setPatients(
        pSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      );
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
      patientName: "", phone: "", wardId: wards[0]?.id || "", bedNumber: "", roomNumber: "",
      patientClass: "GENERAL", isSpecialPatient: false,
      specialMealType: "NONE", specialInstructions: "", status: "ADMITTED",
    });
    setShowModal(true);
  }

  function openEdit(p) {
    setEditingPatient(p);
    setForm({
      patientName: p.patientName, phone: p.phone || "", wardId: p.wardId, bedNumber: p.bedNumber,
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
    setSaveError("");
    try {
      const ward = wards.find(w => w.id === form.wardId);
      const payload = {
        ...form,
        phone: form.phone.trim(),
        wardName: ward?.name || "",
        updatedAt: serverTimestamp(),
      };
      if (editingPatient) {
        await updateDoc(doc(db, "patients", editingPatient.id), payload);
      } else {
        await addDoc(collection(db, "patients"), {
          ...payload,
          createdBy: currentUser?.uid,
          createdByName: userProfile.fullName || "",
          createdAt: serverTimestamp(),
          dischargedAt: null,
        });
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      console.error(err);
      setSaveError("Could not save patient. Please try again.");
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
  const admittedCount = patients.filter((p) => p.status === "ADMITTED").length;

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Patients</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
              {admittedCount} admitted
            </span>
            {search && (
              <span className="inline-flex items-center rounded-full bg-primary-50 px-2.5 py-0.5 text-[11px] font-semibold text-primary-700">
                {filtered.length} result{filtered.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 active:scale-95"
        >
          <Plus size={15} />
          <span>Add Patient</span>
        </button>
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, bed or ward…"
          className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:bg-slate-100"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* ── Patient list ── */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-primary-500" />
          <p className="mt-3 text-xs text-slate-400">Loading patients…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <Search size={20} className="text-slate-400" />
          </div>
          <p className="mt-3 text-sm font-medium text-slate-700">
            {search ? "No patients match your search" : "No patients yet"}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {search ? "Try a different name, bed or ward" : "Add a patient to get started"}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="lg:hidden space-y-2">
            {filtered.map((p) => (
              <div
                key={p.id}
                className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
              >
                <div className="flex items-start gap-2.5">
                  <PatientAvatar name={p.patientName} patientClass={p.patientClass} />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">{p.patientName}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {p.wardName}
                          <span className="mx-1 text-slate-300">·</span>
                          Bed {p.bedNumber}
                          {p.roomNumber && <span className="text-slate-400"> · Rm {p.roomNumber}</span>}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[p.status] || "bg-slate-100 text-slate-500 border-slate-200"}`}>
                        {p.status === "ADMITTED" ? "Admitted" : p.status === "DISCHARGED" ? "Discharged" : p.status}
                      </span>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${CLASS_BADGE[p.patientClass] || "bg-slate-100 text-slate-600 border-transparent"}`}>
                        {(p.patientClass === "VIP" || p.patientClass === "VVIP") && (
                          <Crown size={9} className={p.patientClass === "VVIP" ? "text-purple-500" : "text-amber-500"} />
                        )}
                        {PATIENT_CLASS_LABELS[p.patientClass] || p.patientClass}
                      </span>
                      {p.isSpecialPatient && (
                        <span className="rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-[10px] font-semibold text-primary-700">
                          {p.specialMealType !== "NONE" ? p.specialMealType.replace(/_/g, " ") : "Special diet"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-2.5 flex items-center gap-2 border-t border-slate-100 pt-2">
                  <button
                    onClick={() => openEdit(p)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 active:scale-95"
                  >
                    <Pencil size={11} />
                    Edit
                  </button>
                  {p.status === "ADMITTED" ? (
                    <button
                      onClick={() => handleDischarge(p)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-100 bg-red-50 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100 active:scale-95"
                    >
                      <LogOut size={11} />
                      Discharge
                    </button>
                  ) : (
                    <div className="flex-1" />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Patient</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Location</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Class</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Dietary</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(p => (
                  <tr key={p.id} className="group transition-colors hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <PatientAvatar name={p.patientName} patientClass={p.patientClass} />
                        <span className="font-semibold text-slate-800">{p.patientName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {p.wardName}
                      <span className="mx-1 text-slate-300">·</span>
                      Bed {p.bedNumber}
                      {p.roomNumber && <span className="text-slate-400"> (Rm {p.roomNumber})</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${CLASS_BADGE[p.patientClass] || "bg-slate-100 text-slate-600 border-transparent"}`}>
                        {(p.patientClass === "VIP" || p.patientClass === "VVIP") && (
                          <Crown size={9} className={p.patientClass === "VVIP" ? "text-purple-500" : "text-amber-500"} />
                        )}
                        {PATIENT_CLASS_LABELS[p.patientClass] || p.patientClass}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {p.isSpecialPatient ? (
                        <span className="rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-[10px] font-semibold text-primary-700">
                          {p.specialMealType !== "NONE" ? p.specialMealType.replace(/_/g, " ") : "Special"}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[p.status] || "bg-slate-100 text-slate-500 border-slate-200"}`}>
                        {p.status === "ADMITTED" ? "Admitted" : p.status === "DISCHARGED" ? "Discharged" : p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEdit(p)}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        >
                          <Pencil size={11} />
                          Edit
                        </button>
                        {p.status === "ADMITTED" && (
                          <button
                            onClick={() => handleDischarge(p)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
                          >
                            <LogOut size={11} />
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
        </>
      )}

      {/* ── Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm lg:items-center lg:p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-t-3xl bg-white shadow-2xl lg:rounded-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {editingPatient ? "Edit Patient" : "New Patient"}
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {editingPatient ? "Update patient information" : "Fill in the details below"}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="max-h-[80vh] overflow-y-auto">
              <div className="space-y-5 p-5">
                {saveError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                    {saveError}
                  </div>
                )}

                {/* Patient info */}
                <div className="space-y-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Patient Info</p>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-700">Full Name *</label>
                    <input
                      required
                      value={form.patientName}
                      onChange={e => setForm(f => ({ ...f, patientName: e.target.value }))}
                      placeholder="e.g. John Mensah"
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-700">Phone Number</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="e.g. 024 123 4567"
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-700">Patient Class *</label>
                    <div className="grid grid-cols-3 gap-2">
                      {PATIENT_CLASSES.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, patientClass: c }))}
                          className={`rounded-xl border py-2.5 text-xs font-semibold transition-colors ${
                            form.patientClass === c
                              ? c === "VVIP"
                                ? "border-purple-300 bg-purple-100 text-purple-800"
                                : c === "VIP"
                                ? "border-amber-300 bg-amber-100 text-amber-800"
                                : "border-primary-400 bg-primary-50 text-primary-700"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {c === "VVIP" || c === "VIP" ? (
                            <span className="flex items-center justify-center gap-1">
                              <Crown size={10} />
                              {PATIENT_CLASS_LABELS[c]}
                            </span>
                          ) : PATIENT_CLASS_LABELS[c]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Location */}
                <div className="space-y-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Location</p>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-700">Ward *</label>
                    <select
                      required
                      value={form.wardId}
                      onChange={e => setForm(f => ({ ...f, wardId: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                    >
                      <option value="">Select ward</option>
                      {wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-700">Bed Number *</label>
                      <input
                        required
                        value={form.bedNumber}
                        onChange={e => setForm(f => ({ ...f, bedNumber: e.target.value }))}
                        placeholder="e.g. 14A"
                        className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-700">Room Number</label>
                      <input
                        value={form.roomNumber}
                        onChange={e => setForm(f => ({ ...f, roomNumber: e.target.value }))}
                        placeholder="Optional"
                        className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                {/* Dietary */}
                <div className="space-y-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Dietary</p>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:bg-slate-50">
                    <input
                      type="checkbox"
                      id="special"
                      checked={form.isSpecialPatient}
                      onChange={e => setForm(f => ({ ...f, isSpecialPatient: e.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-400"
                    />
                    <div>
                      <p className="text-xs font-semibold text-slate-800">Special dietary requirement</p>
                      <p className="text-[11px] text-slate-500">Puree, NG tube, diabetic, low-salt, etc.</p>
                    </div>
                  </label>
                  {form.isSpecialPatient && (
                    <div className="space-y-3 rounded-xl border border-primary-100 bg-primary-50/40 p-3">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-slate-700">Meal Type</label>
                        <select
                          value={form.specialMealType}
                          onChange={e => setForm(f => ({ ...f, specialMealType: e.target.value }))}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                        >
                          {SPECIAL_MEAL_TYPES.map(t => (
                            <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-slate-700">Special Instructions</label>
                        <textarea
                          value={form.specialInstructions}
                          onChange={e => setForm(f => ({ ...f, specialInstructions: e.target.value }))}
                          rows={2}
                          placeholder="e.g. No salt, soft diet only…"
                          className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Status (edit only) */}
                {editingPatient && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Status</p>
                    <select
                      value={form.status}
                      onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                    >
                      {["ADMITTED", "DISCHARGED", "TRANSFERRED"].map(s => (
                        <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Modal footer */}
              <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-primary-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:opacity-60"
                >
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

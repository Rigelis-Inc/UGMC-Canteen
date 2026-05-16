import { useEffect, useState, useCallback } from "react";
import { collection, getDocs, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../../config/firebase";
import { Search, UserRound, BedDouble, Crown, X, ArrowRightCircle, LogOut, Loader2 } from "lucide-react";

const PATIENT_CLASSES = ["GENERAL", "VIP", "VVIP", "NG_TUBE"];
const PATIENT_CLASS_LABELS = {
  GENERAL: "General",
  VIP: "VIP",
  VVIP: "VVIP",
  NG_TUBE: "NG Tube",
};

const CLASS_COLORS = {
  GENERAL: "bg-slate-100 text-slate-700",
  VIP: "bg-amber-50 text-amber-800 border border-amber-200",
  VVIP: "bg-purple-50 text-purple-800 border border-purple-200",
  NG_TUBE: "bg-red-50 text-red-800 border border-red-200",
};

const CLASS_BADGE_DETAILS = {
  GENERAL: null,
  VIP: { label: "VIP", iconClass: "text-amber-600" },
  VVIP: { label: "VVIP", iconClass: "text-purple-600" },
  NG_TUBE: { label: "NG Tube", iconClass: "text-red-600" },
};

const SPECIAL_MEAL_LABELS = {
  NONE: "—",
  PUREE: "Puree",
  NG_TUBE: "NG Tube",
  SOFT_DIET: "Soft Diet",
  NO_SALT: "No Salt",
  DIABETIC: "Diabetic",
  OTHER: "Other",
};

export default function KitchenPatientsPage() {
  const [patients, setPatients] = useState([]);
  const [wards, setWards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [wardFilter, setWardFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ADMITTED");

  const [transferPatient, setTransferPatient] = useState(null);
  const [dischargePatient, setDischargePatient] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [transferForm, setTransferForm] = useState({ wardId: "", bedNumber: "", roomNumber: "" });
  const [actionError, setActionError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const wSnap = await getDocs(collection(db, "wards"));
      const wardList = wSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setWards(wardList);

      const pSnap = await getDocs(collection(db, "patients"));
      setPatients(
        pSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            if (a.status !== b.status) return a.status === "ADMITTED" ? -1 : 1;
            return String(a.bedNumber).localeCompare(String(b.bedNumber), undefined, { numeric: true });
          })
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const wardOptions = wards
    .filter(w => w.isActive !== false)
    .map(w => w.name)
    .filter(Boolean)
    .sort();

  const filtered = patients.filter(p => {
    if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
    if (wardFilter !== "ALL" && p.wardName !== wardFilter) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      return (
        p.patientName?.toLowerCase().includes(s) ||
        String(p.phone || "").toLowerCase().includes(s) ||
        String(p.bedNumber).toLowerCase().includes(s) ||
        p.wardName?.toLowerCase().includes(s) ||
        p.roomNumber?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const admittedCount = patients.filter(p => p.status === "ADMITTED").length;
  const dischargedCount = patients.filter(p => p.status === "DISCHARGED").length;
  const transferredCount = patients.filter(p => p.status === "TRANSFERRED").length;

  function openTransfer(p) {
    setTransferPatient(p);
    setTransferForm({ wardId: "", bedNumber: "", roomNumber: "" });
    setActionError("");
  }

  function openDischarge(p) {
    setDischargePatient(p);
    setActionError("");
  }

  async function handleTransfer() {
    if (!transferPatient || !transferForm.wardId || !transferForm.bedNumber.trim()) return;
    setActionLoading(true);
    setActionError("");
    try {
      const targetWard = wards.find(w => w.id === transferForm.wardId);
      await updateDoc(doc(db, "patients", transferPatient.id), {
        wardId: targetWard.id,
        wardName: targetWard.name,
        bedNumber: transferForm.bedNumber.trim(),
        roomNumber: transferForm.roomNumber.trim(),
        status: "ADMITTED",
        updatedAt: serverTimestamp(),
      });
      setTransferPatient(null);
      loadData();
    } catch (e) {
      console.error(e);
      setActionError("Failed to transfer patient. Please try again.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDischarge() {
    if (!dischargePatient) return;
    setActionLoading(true);
    setActionError("");
    try {
      await updateDoc(doc(db, "patients", dischargePatient.id), {
        status: "DISCHARGED",
        dischargedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setDischargePatient(null);
      loadData();
    } catch (e) {
      console.error(e);
      setActionError("Failed to discharge patient. Please try again.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Patients</h1>
        <p className="text-sm text-slate-500">All patients across all wards</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard label="Admitted" value={admittedCount} accent="emerald" />
        <StatCard label="Discharged" value={dischargedCount} accent="slate" />
        <StatCard label="Transferred" value={transferredCount} accent="blue" />
        <StatCard label="Total" value={patients.length} accent="default" />
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone, bed, ward, room…"
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          />
        </div>
        <select value={wardFilter} onChange={e => setWardFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white min-w-[140px]">
          <option value="ALL">All Wards</option>
          {wardOptions.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className={`border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white min-w-[130px] ${
            statusFilter !== "ADMITTED"
              ? "border-primary-200 bg-primary-50 text-primary-700"
              : "border-slate-200 text-slate-600"
          }`}>
          <option value="ALL">All Statuses</option>
          <option value="ADMITTED">Admitted</option>
          <option value="DISCHARGED">Discharged</option>
          <option value="TRANSFERRED">Transferred</option>
        </select>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserRound size={14} className="text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-800">Patient Directory</h2>
          </div>
          <span className="text-[10px] text-slate-500">{filtered.length} patient{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading patients…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <UserRound size={28} className="mx-auto text-slate-300 mb-2" />
            <p className="text-slate-500 text-sm">No patients match your filters.</p>
          </div>
        ) : (
          <>
            <div className="md:hidden divide-y divide-slate-100">
              {filtered.map(p => (
                <div key={p.id} className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">{p.patientName}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {p.wardName}
                        <span className="mx-1 text-slate-300">·</span>
                        Bed {p.bedNumber}
                        {p.roomNumber && <span>· Rm {p.roomNumber}</span>}
                      </p>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${
                      p.status === "ADMITTED" ? "bg-emerald-50 text-emerald-700" :
                      p.status === "DISCHARGED" ? "bg-slate-100 text-slate-500" :
                      "bg-blue-50 text-blue-700"
                    }`}>
                      {p.status === "ADMITTED" ? "Admitted" : p.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${CLASS_COLORS[p.patientClass] || "bg-slate-100 text-slate-600"}`}>
                      {CLASS_BADGE_DETAILS[p.patientClass]?.iconClass && (
                        <Crown size={10} className={CLASS_BADGE_DETAILS[p.patientClass].iconClass} />
                      )}
                      <span>{CLASS_BADGE_DETAILS[p.patientClass]?.label || p.patientClass}</span>
                    </span>
                    {p.isSpecialPatient && p.specialMealType && p.specialMealType !== "NONE" && (
                      <span className="px-1.5 py-0.5 rounded bg-primary-50 text-primary-700 text-[10px] font-medium">
                        {SPECIAL_MEAL_LABELS[p.specialMealType] || p.specialMealType}
                      </span>
                    )}
                  </div>

                  {p.status === "ADMITTED" && (
                    <div className="flex items-center gap-2 pt-1">
                      <button onClick={() => openTransfer(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors">
                        <ArrowRightCircle size={11} /> Transfer
                      </button>
                      <button onClick={() => openDischarge(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors">
                        <LogOut size={11} /> Discharge
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase">Patient</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase">Phone</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase">Ward</th>
                    <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase">Bed</th>
                    <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase">Room</th>
                    <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase">Class</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase">Diet</th>
                    <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase">Status</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-medium text-slate-800">{p.patientName}</td>
                      <td className="px-4 py-2.5 text-slate-600">{p.phone || "—"}</td>
                      <td className="px-4 py-2.5 text-slate-600">{p.wardName || "—"}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums">
                        <span className="inline-flex items-center gap-1"><BedDouble size={10} className="text-slate-400" /> {p.bedNumber}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center tabular-nums text-slate-600">{p.roomNumber || "—"}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${CLASS_COLORS[p.patientClass] || "bg-slate-100 text-slate-600"}`}>
                          {CLASS_BADGE_DETAILS[p.patientClass]?.iconClass && (
                            <Crown size={9} className={CLASS_BADGE_DETAILS[p.patientClass].iconClass} />
                          )}
                          <span>{CLASS_BADGE_DETAILS[p.patientClass]?.label || p.patientClass}</span>
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {p.isSpecialPatient && p.specialMealType && p.specialMealType !== "NONE" ? (
                          <span className="text-primary-700 font-medium">{SPECIAL_MEAL_LABELS[p.specialMealType] || p.specialMealType}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          p.status === "ADMITTED" ? "bg-emerald-50 text-emerald-700" :
                          p.status === "DISCHARGED" ? "bg-slate-100 text-slate-500" :
                          "bg-blue-50 text-blue-700"
                        }`}>
                          {p.status === "ADMITTED" ? "Admitted" : p.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {p.status === "ADMITTED" ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => openTransfer(p)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-blue-600 hover:bg-blue-50 transition-colors">
                              <ArrowRightCircle size={11} /> Transfer
                            </button>
                            <button onClick={() => openDischarge(p)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-red-600 hover:bg-red-50 transition-colors">
                              <LogOut size={11} /> Discharge
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Transfer Modal */}
      {transferPatient && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
          <div className="bg-white rounded-t-3xl sm:rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800 text-sm">Transfer Patient</h2>
              <button onClick={() => setTransferPatient(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X size={14} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs font-medium text-slate-800">{transferPatient.patientName}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {transferPatient.wardName} · Bed {transferPatient.bedNumber}
                  {transferPatient.roomNumber && <span> · Rm {transferPatient.roomNumber}</span>}
                </p>
              </div>

              {actionError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {actionError}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Target Ward *</label>
                <select value={transferForm.wardId}
                  onChange={e => setTransferForm(f => ({ ...f, wardId: e.target.value }))}
                  className="w-full border border-slate-200 rounded-md px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="">Select ward</option>
                  {wards
                    .filter(w => w.isActive !== false)
                    .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
                    .map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Bed Number *</label>
                  <input value={transferForm.bedNumber}
                    onChange={e => setTransferForm(f => ({ ...f, bedNumber: e.target.value }))}
                    placeholder="e.g. 12"
                    className="w-full border border-slate-200 rounded-md px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Room Number</label>
                  <input value={transferForm.roomNumber}
                    onChange={e => setTransferForm(f => ({ ...f, roomNumber: e.target.value }))}
                    placeholder="Optional"
                    className="w-full border border-slate-200 rounded-md px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-1">
                <button type="button" onClick={() => setTransferPatient(null)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 transition-colors w-full sm:w-auto">
                  Cancel
                </button>
                <button onClick={handleTransfer}
                  disabled={actionLoading || !transferForm.wardId || !transferForm.bedNumber.trim()}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-xs font-medium hover:bg-primary-700 disabled:opacity-60 transition-colors w-full sm:w-auto">
                  {actionLoading ? <Loader2 size={13} className="animate-spin" /> : <ArrowRightCircle size={13} />}
                  {actionLoading ? "Transferring…" : "Transfer Patient"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Discharge Confirmation Modal */}
      {dischargePatient && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
          <div className="bg-white rounded-t-3xl sm:rounded-xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800 text-sm">Discharge Patient</h2>
              <button onClick={() => setDischargePatient(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X size={14} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs font-medium text-slate-800">{dischargePatient.patientName}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {dischargePatient.wardName} · Bed {dischargePatient.bedNumber}
                </p>
              </div>

              {actionError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {actionError}
                </div>
              )}

              <p className="text-xs text-slate-600">
                Are you sure you want to discharge this patient? This action cannot be undone.
              </p>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-1">
                <button type="button" onClick={() => setDischargePatient(null)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 transition-colors w-full sm:w-auto">
                  Cancel
                </button>
                <button onClick={handleDischarge}
                  disabled={actionLoading}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-60 transition-colors w-full sm:w-auto">
                  {actionLoading ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
                  {actionLoading ? "Discharging…" : "Confirm Discharge"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }) {
  const accentColors = {
    default: "border-l-slate-300",
    emerald: "border-l-emerald-500",
    blue: "border-l-blue-500",
    slate: "border-l-slate-400",
  };
  return (
    <div className={`bg-white rounded-lg border border-slate-200 border-l-4 ${accentColors[accent]} px-3 py-2.5`}>
      <p className="text-xl font-bold text-slate-900 leading-none tabular-nums">{value}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

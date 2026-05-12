import { useEffect, useState, useCallback } from "react";
import {
  collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, doc, getDoc, limit
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { format, getDay } from "date-fns";
import { AlertTriangle, Send, X } from "lucide-react";

const DAYS = ["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"];
const PERIODS = ["BREAKFAST","LUNCH","SUPPER"];
const PERIOD_TIMES = { BREAKFAST: "06:00", LUNCH: "12:00", SUPPER: "17:00" };
const LATE_REASONS = [
  { value: "NEW_PATIENT", label: "New patient" },
  { value: "MISSED_ORDER", label: "Missed order" },
  { value: "PATIENT_TRANSFER", label: "Patient transfer" },
  { value: "EMERGENCY_ADMISSION", label: "Emergency admission" },
  { value: "DIET_CHANGE", label: "Doctor/diet change" },
  { value: "OTHER", label: "Other" },
];

function isPastCutoff(period) {
  const [hh, mm] = PERIOD_TIMES[period].split(":").map(Number);
  const cutoff = new Date();
  cutoff.setHours(hh, mm, 0, 0);
  return new Date() > cutoff;
}

function orderNum() {
  return "WO-" + Date.now().toString(36).toUpperCase();
}

export default function NurseMealOrdersPage() {
  const { userProfile, assignedWards } = useAuth();
  const [period, setPeriod] = useState("LUNCH");
  const [orderDate, setOrderDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [patients, setPatients] = useState([]);
  const [menuItems, setMenuItems] = useState({ mains: [], sides: [], drinks: [] });
  const [vipMenu, setVipMenu] = useState({ appetisers: [], desserts: [] });
  const [rows, setRows] = useState([]); // per-patient order row
  const [lateReason, setLateReason] = useState("NEW_PATIENT");
  const [lateDetails, setLateDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const dayOfWeek = DAYS[getDay(new Date(orderDate + "T12:00:00"))];
  const isLate = isPastCutoff(period);

  // Load meal ordering settings
  useEffect(() => {
    getDoc(doc(db, "settings", "mealOrdering")).then(snap => {
      if (snap.exists()) setSettings(snap.data());
    });
  }, []);

  // Load admitted patients
  const loadPatients = useCallback(async () => {
    if (!userProfile) return;
    setLoading(true);
    try {
      const wardFilter = assignedWards.length > 0 ? assignedWards : null;
      let q;
      if (wardFilter) {
        q = query(collection(db, "patients"),
          where("wardId", "in", wardFilter.slice(0,10)),
          where("status", "==", "ADMITTED"),
          orderBy("bedNumber"));
      } else {
        q = query(collection(db, "patients"), where("status", "==", "ADMITTED"), orderBy("bedNumber"));
      }
      const snap = await getDocs(q);
      const pts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPatients(pts);
      setRows(pts.map(p => ({
        patientId: p.id, patientName: p.patientName, wardId: p.wardId,
        wardName: p.wardName, bedNumber: p.bedNumber, roomNumber: p.roomNumber || "",
        patientClass: p.patientClass, isSpecialPatient: p.isSpecialPatient || false,
        specialMealType: p.specialMealType || "NONE", specialInstructions: p.specialInstructions || "",
        mainMeal: "", appetiser: "", dessert: "", notes: "", include: true,
      })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [userProfile, assignedWards]);

  useEffect(() => { loadPatients(); }, [loadPatients]);

  // Load VIP menu from settings once
  useEffect(() => {
    getDoc(doc(db, "settings", "vipMenu")).then(snap => {
      if (snap.exists()) setVipMenu(snap.data());
    }).catch(() => {});
  }, []);

  // Load menu for selected day + period (one doc, applies to all patients)
  useEffect(() => {
    async function loadMenu() {
      try {
        const snap = await getDocs(
          query(collection(db, "mealMenus"),
            where("dayOfWeek", "==", dayOfWeek),
            where("mealPeriod", "==", period),
            where("isActive", "==", true),
            limit(1))
        );
        if (!snap.empty) {
          const data = snap.docs[0].data();
          const items = data.items || [];
          setMenuItems({
            mains:  items.filter(i => i.category === "MAIN").map(i => i.name),
            sides:  items.filter(i => i.category === "SIDE").map(i => i.name),
            drinks: items.filter(i => i.category === "DRINK").map(i => i.name),
          });
        } else {
          setMenuItems({ mains: [], sides: [], drinks: [] });
        }
      } catch (e) {
        console.error(e);
        setMenuItems({ mains: [], sides: [], drinks: [] });
      }
    }
    loadMenu();
    setRows(r => r.map(x => ({ ...x, mainMeal: "", appetiser: "", dessert: "" })));
  }, [dayOfWeek, period]);

  function updateRow(idx, field, value) {
    setRows(rows => rows.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }

  async function handleSubmit() {
    const toOrder = rows.filter(r => r.include && r.mainMeal);
    if (toOrder.length === 0) {
      alert("Select at least one patient and main meal.");
      return;
    }
    if (isLate && !lateReason) {
      alert("Please select a late reason.");
      return;
    }
    setSubmitting(true);
    try {
      const batch = toOrder.map(r => addDoc(collection(db, "wardMealOrders"), {
        orderNumber: orderNum(),
        orderDate,
        dayOfWeek,
        mealPeriod: period,
        wardId: r.wardId,
        wardName: r.wardName,
        patientId: r.patientId,
        patientName: r.patientName,
        bedNumber: r.bedNumber,
        roomNumber: r.roomNumber,
        patientClass: r.patientClass,
        isSpecialPatient: r.isSpecialPatient,
        specialMealType: r.specialMealType,
        mainMeal: { name: r.mainMeal, price: 0, notes: r.notes },
        appetiser: r.appetiser ? { name: r.appetiser, price: 0 } : null,
        dessert: r.dessert ? { name: r.dessert, price: 0 } : null,
        specialInstructions: r.specialInstructions || "",
        isLate,
        lateReason: isLate ? lateReason : null,
        lateReasonDetails: isLate ? lateDetails : "",
        status: "REQUESTED",
        requestedBy: userProfile.uid,
        requestedByName: userProfile.fullName || "",
        requestedAt: serverTimestamp(),
        servedBy: null, servedByName: null, servedAt: null,
        deliveredBy: null, deliveredByName: null, deliveredAt: null,
        cancelledBy: null, cancelledByName: null, cancelledAt: null,
        cancellationReason: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));
      await Promise.all(batch);
      setSubmitted(true);
    } catch (e) {
      console.error(e);
      alert("Error submitting orders. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
          <Send size={28} className="text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Orders Submitted!</h2>
        <p className="text-slate-500 text-sm">Meal orders sent to the kitchen for {period} on {orderDate}.</p>
        <button onClick={() => { setSubmitted(false); loadPatients(); }}
          className="px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">
          Place More Orders
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Place Meal Orders</h1>
        <p className="text-sm text-slate-500">Order meals for admitted patients in your ward</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Date</label>
          <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Meal Period</label>
          <div className="flex gap-2">
            {PERIODS.map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${period === p ? "bg-primary-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                {p[0] + p.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 text-sm text-slate-500">
          <span className="font-medium text-slate-700">{dayOfWeek}</span>
          <span>·</span>
          <span>Cutoff: {PERIOD_TIMES[period]}</span>
          {isLate && (
            <span className="flex items-center gap-1 text-amber-600 font-medium">
              <AlertTriangle size={13} /> PAST CUTOFF
            </span>
          )}
        </div>
      </div>

      {/* Late order reason */}
      {isLate && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
            <AlertTriangle size={16} />
            This is a late order. Please provide a reason.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-amber-700 mb-1">Reason *</label>
              <select value={lateReason} onChange={e => setLateReason(e.target.value)}
                className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white">
                {LATE_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-amber-700 mb-1">Additional details</label>
              <input value={lateDetails} onChange={e => setLateDetails(e.target.value)}
                placeholder="Optional details…"
                className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white" />
            </div>
          </div>
        </div>
      )}

      {/* Menu preview */}
      {menuItems.mains.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">
            {dayOfWeek} {PERIOD_LABEL[period]} Menu
          </p>
          <div className="flex flex-wrap gap-2">
            {menuItems.mains.map((m, i) => (
              <span key={m} className="px-2 py-1 bg-white border border-blue-200 rounded-md text-xs text-blue-800">
                {i + 1}. {m}
              </span>
            ))}
          </div>
          {(menuItems.sides.length > 0 || menuItems.drinks.length > 0) && (
            <p className="text-xs text-blue-500 mt-2">
              Included: {[...menuItems.sides, ...menuItems.drinks].join(" · ")}
            </p>
          )}
        </div>
      )}

      {/* Bulk order table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800 text-sm">
            Admitted Patients ({rows.filter(r => r.include).length} selected)
          </h2>
          <div className="flex gap-2">
            <button onClick={() => setRows(r => r.map(x => ({ ...x, include: true })))}
              className="text-xs text-primary-600 hover:underline">Select all</button>
            <span className="text-slate-300">·</span>
            <button onClick={() => setRows(r => r.map(x => ({ ...x, include: false })))}
              className="text-xs text-slate-500 hover:underline">Deselect all</button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading patients…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No admitted patients in your ward.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-3 py-2.5 text-left"><input type="checkbox" onChange={e => setRows(r => r.map(x => ({ ...x, include: e.target.checked })))} className="rounded border-slate-300 text-primary-600" /></th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-600">Patient</th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-600">Bed</th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-600">Class</th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-600">Main Meal *</th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-600">Appetiser</th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-600">Dessert</th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-600">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, idx) => (
                  <tr key={row.patientId} className={`${row.include ? "" : "opacity-40"}`}>
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={row.include}
                        onChange={e => updateRow(idx, "include", e.target.checked)}
                        className="rounded border-slate-300 text-primary-600" />
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-800">{row.patientName}</p>
                      {row.isSpecialPatient && (
                        <p className="text-amber-600 text-xs">{row.specialMealType !== "NONE" ? row.specialMealType : "Special"}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{row.bedNumber}</td>
                    <td className="px-3 py-2">
                      <span className="text-xs font-medium text-slate-600">{row.patientClass}</span>
                    </td>
                    {(() => {
                      const noMenu = menuItems.mains.length === 0;
                      const isVip = ["VIP", "VVIP"].includes(row.patientClass);
                      const isNgTube = row.patientClass === "NG_TUBE";
                      return (
                        <>
                          <td className="px-3 py-2">
                            {isNgTube ? (
                              <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded">NG Tube — special feed</span>
                            ) : noMenu ? (
                              <span className="text-xs text-amber-600">No menu set for today</span>
                            ) : (
                              <select value={row.mainMeal} onChange={e => updateRow(idx, "mainMeal", e.target.value)}
                                disabled={!row.include}
                                className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 min-w-[200px]">
                                <option value="">— Select meal —</option>
                                {menuItems.mains.map((x, i) => <option key={x} value={x}>{i + 1}. {x}</option>)}
                              </select>
                            )}
                          </td>
                          {/* Appetiser — VIP/VVIP only */}
                          <td className="px-3 py-2">
                            {isVip ? (
                              <select value={row.appetiser} onChange={e => updateRow(idx, "appetiser", e.target.value)}
                                disabled={!row.include}
                                className="w-full border border-amber-200 bg-amber-50 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 min-w-[140px]">
                                <option value="">— None —</option>
                                {(vipMenu.appetisers || []).map(a => (
                                  <option key={a.code} value={a.name}>{a.code}. {a.name}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </td>
                          {/* Dessert — VIP/VVIP only */}
                          <td className="px-3 py-2">
                            {isVip ? (
                              <select value={row.dessert} onChange={e => updateRow(idx, "dessert", e.target.value)}
                                disabled={!row.include}
                                className="w-full border border-amber-200 bg-amber-50 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 min-w-[140px]">
                                <option value="">— None —</option>
                                {(vipMenu.desserts || []).map(d => (
                                  <option key={d.code} value={d.name}>{d.code}. {d.name}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </td>
                        </>
                      );
                    })()}
                    <td className="px-3 py-2">
                      <input value={row.notes} onChange={e => updateRow(idx, "notes", e.target.value)}
                        disabled={!row.include}
                        placeholder="Special notes…"
                        className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 min-w-[120px]" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-5 py-4">
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{rows.filter(r => r.include && r.mainMeal).length}</span> order{rows.filter(r => r.include && r.mainMeal).length !== 1 ? "s" : ""} ready to submit
        </p>
        <button onClick={handleSubmit} disabled={submitting || rows.filter(r => r.include && r.mainMeal).length === 0}
          className="inline-flex items-center gap-2 px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-sm">
          <Send size={15} />
          {submitting ? "Submitting…" : "Submit Orders to Kitchen"}
        </button>
      </div>
    </div>
  );
}

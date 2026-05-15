import { useEffect, useState, useCallback } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  limit,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { format, getDay } from "date-fns";
import { AlertTriangle, CheckCircle2, Send } from "lucide-react";

const DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const PERIODS = ["BREAKFAST", "LUNCH", "SUPPER"];
const PERIOD_LABEL = { BREAKFAST: "Breakfast", LUNCH: "Lunch", SUPPER: "Supper" };
const PERIOD_DEFAULT_CUTOFFS = { BREAKFAST: "06:00", LUNCH: "12:00", SUPPER: "17:00" };
const PERIOD_CUTOFF_KEYS = {
  BREAKFAST: "breakfastCutoffTime",
  LUNCH: "lunchCutoffTime",
  SUPPER: "supperCutoffTime",
};
const LATE_REASONS = [
  { value: "NEW_PATIENT", label: "New patient" },
  { value: "MISSED_ORDER", label: "Missed order" },
  { value: "PATIENT_TRANSFER", label: "Patient transfer" },
  { value: "EMERGENCY_ADMISSION", label: "Emergency admission" },
  { value: "DIET_CHANGE", label: "Doctor/diet change" },
  { value: "OTHER", label: "Other" },
];

function isPastCutoff(cutoffTime) {
  const [hh, mm] = cutoffTime.split(":").map(Number);
  const cutoff = new Date();
  cutoff.setHours(hh, mm, 0, 0);
  return new Date() > cutoff;
}

function getCurrentPeriod(settings) {
  const now = new Date();
  const cutoffs = PERIODS.map((p) => {
    const key = PERIOD_CUTOFF_KEYS[p];
    const val = settings?.[key] || PERIOD_DEFAULT_CUTOFFS[p];
    const [hh, mm] = val.split(":").map(Number);
    const cutoff = new Date();
    cutoff.setHours(hh, mm, 0, 0);
    return { period: p, cutoff };
  });

  for (const { period, cutoff } of cutoffs) {
    if (now < cutoff) return period;
  }
  return "SUPPER";
}

function orderNum() {
  return "WO-" + Date.now().toString(36).toUpperCase();
}

function isVipClass(patientClass) {
  return ["VIP", "VVIP"].includes(patientClass);
}

function createRow(patient) {
  return {
    patientId: patient.id,
    patientName: patient.patientName,
    phone: patient.phone || "",
    wardId: patient.wardId,
    wardName: patient.wardName,
    bedNumber: patient.bedNumber,
    roomNumber: patient.roomNumber || "",
    patientClass: patient.patientClass,
    isSpecialPatient: patient.isSpecialPatient || false,
    specialMealType: patient.specialMealType || "NONE",
    specialInstructions: patient.specialInstructions || "",
    mainMeal: "",
    appetiser: "",
    dessert: "",
    notes: "",
    include: true,
  };
}

export default function NurseMealOrdersPage() {
  const { currentUser, userProfile, assignedWards } = useAuth();
  const [period, setPeriod] = useState(() => getCurrentPeriod(null));
  const [orderDate, setOrderDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [patients, setPatients] = useState([]);
  const [menuItems, setMenuItems] = useState({ mains: [], sides: [], drinks: [] });
  const [vipMenu, setVipMenu] = useState({ appetisers: [], desserts: [] });
  const [rows, setRows] = useState([]);
  const [lateReason, setLateReason] = useState("NEW_PATIENT");
  const [lateDetails, setLateDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const dayOfWeek = DAYS[getDay(new Date(orderDate + "T12:00:00"))];
  const cutoffTime = settings
    ? settings[PERIOD_CUTOFF_KEYS[period]] || PERIOD_DEFAULT_CUTOFFS[period]
    : PERIOD_DEFAULT_CUTOFFS[period];
  const isLate = isPastCutoff(cutoffTime);
  const includedItems = [...menuItems.sides, ...menuItems.drinks];
  const selectedPatients = rows.filter((r) => r.include).length;
  const selectedMeals = rows.filter((r) => r.include && r.mainMeal).length;

  useEffect(() => {
    getDoc(doc(db, "settings", "mealOrdering")).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSettings(data);
        setPeriod(getCurrentPeriod(data));
      }
    });
  }, []);

  const loadPatients = useCallback(async () => {
    if (!userProfile) return;
    setLoading(true);
    try {
      const wardFilter = assignedWards.length > 0 ? assignedWards : null;
      let q;
      if (wardFilter) {
        q = query(
          collection(db, "patients"),
          where("wardId", "in", wardFilter.slice(0, 10)),
          where("status", "==", "ADMITTED")
        );
      } else {
        q = query(collection(db, "patients"), where("status", "==", "ADMITTED"));
      }

      const snap = await getDocs(q);
      const pts = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(a.bedNumber).localeCompare(String(b.bedNumber), undefined, { numeric: true }));

      setPatients(pts);
      setRows(pts.map(createRow));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [userProfile, assignedWards]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  useEffect(() => {
    getDoc(doc(db, "settings", "vipMenu"))
      .then((snap) => {
        if (snap.exists()) setVipMenu(snap.data());
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    async function loadMenu() {
      try {
        const snap = await getDocs(
          query(
            collection(db, "mealMenus"),
            where("dayOfWeek", "==", dayOfWeek),
            where("mealPeriod", "==", period),
            where("isActive", "==", true),
            limit(1)
          )
        );

        if (!snap.empty) {
          const data = snap.docs[0].data();
          const items = data.items || [];
          setMenuItems({
            mains: items.filter((i) => i.category === "MAIN").map((i) => i.name),
            sides: items.filter((i) => i.category === "SIDE").map((i) => i.name),
            drinks: items.filter((i) => i.category === "DRINK").map((i) => i.name),
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
    setRows((current) => current.map((row) => ({ ...row, mainMeal: "", appetiser: "", dessert: "" })));
  }, [dayOfWeek, period]);

  function updateRow(idx, field, value) {
    setRows((current) =>
      current.map((row, i) => {
        if (i !== idx) return row;
        const next = { ...row, [field]: value };
        if (field === "mainMeal" && value) next.include = true;
        return next;
      })
    );
  }

  function selectAllPatients() {
    setRows((current) => current.map((row) => ({ ...row, include: true })));
  }

  function clearAllPatients() {
    setRows((current) =>
      current.map((row) => ({
        ...row,
        include: false,
        mainMeal: "",
        appetiser: "",
        dessert: "",
        notes: "",
      }))
    );
  }

  async function handleSubmit() {
    const toOrder = rows.filter((row) => row.include && row.mainMeal);
    if (toOrder.length === 0) {
      alert("Choose at least one meal before submitting.");
      return;
    }
    if (isLate && !lateReason) {
      alert("Please select a late reason.");
      return;
    }

    setSubmitting(true);
    try {
      const batch = toOrder.map((row) =>
        addDoc(collection(db, "wardMealOrders"), {
          orderNumber: orderNum(),
          orderDate,
          dayOfWeek,
          mealPeriod: period,
          wardId: row.wardId,
          wardName: row.wardName,
          patientId: row.patientId,
          patientName: row.patientName,
          phone: row.phone || "",
          bedNumber: row.bedNumber,
          roomNumber: row.roomNumber,
          patientClass: row.patientClass,
          isSpecialPatient: row.isSpecialPatient,
          specialMealType: row.specialMealType,
          mainMeal: { name: row.mainMeal, price: 0, notes: row.notes },
          appetiser: row.appetiser ? { name: row.appetiser, price: 0 } : null,
          dessert: row.dessert ? { name: row.dessert, price: 0 } : null,
          specialInstructions: row.specialInstructions || "",
          isLate,
          lateReason: isLate ? lateReason : null,
          lateReasonDetails: isLate ? lateDetails : "",
          status: "REQUESTED",
          requestedBy: currentUser?.uid,
          requestedByName: userProfile.fullName || "",
          requestedAt: serverTimestamp(),
          servedBy: null,
          servedByName: null,
          servedAt: null,
          deliveredBy: null,
          deliveredByName: null,
          deliveredAt: null,
          cancelledBy: null,
          cancelledByName: null,
          cancelledAt: null,
          cancellationReason: "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
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
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 size={28} className="text-green-600" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-900">Orders submitted</h2>
          <p className="mt-1 text-sm text-slate-500">
            Meal orders sent to the kitchen for {PERIOD_LABEL[period]} on {orderDate}.
          </p>
        </div>
        <button
          onClick={() => {
            setSubmitted(false);
            loadPatients();
          }}
          className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
        >
          Place another order
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-28 lg:pb-0">
      {/* ── Header ── */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Place Meal Orders</h1>
        <p className="mt-0.5 text-[12px] text-slate-500">
          {format(new Date(orderDate + "T12:00:00"), "EEEE, d MMMM yyyy")}
        </p>
      </div>

      {/* ── Controls card ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {/* Period tabs */}
        <div className="grid grid-cols-3 gap-1.5 lg:flex lg:w-fit lg:flex-wrap lg:gap-2">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`w-full rounded-full px-3 py-2 text-xs font-semibold transition-all duration-200 lg:w-auto lg:min-w-[132px] lg:px-5 ${
                period === p
                  ? "bg-primary-600 text-white shadow-sm shadow-primary-600/20"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-700"
              }`}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>

        {/* Date + status pills */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
            {dayOfWeek[0] + dayOfWeek.slice(1).toLowerCase()}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-500">
            Cutoff {cutoffTime}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              isLate ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {isLate ? <AlertTriangle size={10} /> : <CheckCircle2 size={10} />}
            {isLate ? "Past cutoff" : "On time"}
          </span>
        </div>

        {/* Menu strip */}
        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Today's Menu
          </p>
          {menuItems.mains.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                {menuItems.mains.map((meal) => (
                  <span
                    key={meal}
                    className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-700"
                  >
                    {meal}
                  </span>
                ))}
              </div>
              {includedItems.length > 0 && (
                <p className="mt-1.5 text-[10px] text-slate-400">
                  Included: {includedItems.join(" · ")}
                </p>
              )}
            </>
          ) : (
            <p className="text-[11px] text-slate-400">No menu set for {PERIOD_LABEL[period]} yet.</p>
          )}
        </div>
      </div>

      {/* ── Late reason ── */}
      {isLate && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle size={13} className="text-red-600" />
            </div>
            <p className="text-sm font-semibold text-red-800">Late order — provide a reason</p>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-red-700">
                Reason *
              </label>
              <select
                value={lateReason}
                onChange={(e) => setLateReason(e.target.value)}
                className="w-full rounded-xl border border-red-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                {LATE_REASONS.map((reason) => (
                  <option key={reason.value} value={reason.value}>
                    {reason.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-red-700">
                Details
              </label>
              <input
                value={lateDetails}
                onChange={(e) => setLateDetails(e.target.value)}
                placeholder="Optional additional details"
                className="w-full rounded-xl border border-red-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Patient list ── */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-12">
          <p className="text-sm font-semibold text-slate-600">No admitted patients</p>
          <p className="mt-1 text-xs text-slate-400">There are no patients in your assigned ward(s)</p>
        </div>
      ) : (
        <>
          {/* Progress header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <p className="text-xs font-semibold text-slate-700">
                {selectedMeals} / {rows.length} assigned
              </p>
              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-primary-500 transition-all duration-300"
                  style={{ width: `${rows.length > 0 ? (selectedMeals / rows.length) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-semibold">
              <button type="button" onClick={selectAllPatients} className="text-primary-600 hover:underline">
                All
              </button>
              <button type="button" onClick={clearAllPatients} className="text-slate-400 hover:underline">
                Clear
              </button>
            </div>
          </div>

          {/* ─── Mobile cards ─── */}
          <div className="lg:hidden space-y-3">
            {rows.map((row, idx) => {
              const noMenu = menuItems.mains.length === 0;
              const vip = isVipClass(row.patientClass);
              const ngTube = row.patientClass === "NG_TUBE";

              return (
                <article
                  key={row.patientId}
                  className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-opacity ${
                    row.include ? "border-slate-200" : "border-slate-100 opacity-50"
                  }`}
                >
                  {/* Card header row */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={row.include}
                      onChange={(e) => updateRow(idx, "include", e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                      {row.patientName?.[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{row.patientName}</p>
                      <p className="text-[11px] text-slate-500">
                        Bed {row.bedNumber}
                        <span className="mx-1 text-slate-300">·</span>
                        {row.wardName}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {row.isSpecialPatient && (
                        <span className="rounded-full border border-primary-200 bg-primary-50 px-1.5 py-0.5 text-[9px] font-bold text-primary-700">
                          {row.specialMealType !== "NONE" ? row.specialMealType : "Special"}
                        </span>
                      )}
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600">
                        {row.patientClass}
                      </span>
                      {row.include && (
                        <span
                          className={`h-2 w-2 rounded-full ${row.mainMeal ? "bg-emerald-500" : "bg-amber-400"}`}
                          title={row.mainMeal ? "Ready" : "Needs meal"}
                        />
                      )}
                    </div>
                  </div>

                  {/* Meal section (only when included) */}
                  {row.include && (
                    <div className="border-t border-slate-100 px-4 py-3">
                      {ngTube ? (
                        <p className="text-[11px] font-semibold text-red-600">NG Tube — special feed only</p>
                      ) : noMenu ? (
                        <p className="text-[11px] text-slate-400">No menu set for this period</p>
                      ) : (
                        <>
                          <select
                            value={row.mainMeal}
                            onChange={(e) => updateRow(idx, "mainMeal", e.target.value)}
                            disabled={!row.include}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="">— Select meal —</option>
                            {menuItems.mains.map((meal) => (
                              <option key={meal} value={meal}>{meal}</option>
                            ))}
                          </select>
                          {includedItems.length > 0 && (
                            <p className="mt-1.5 text-[10px] text-slate-400">
                              + {includedItems.join(" · ")}
                            </p>
                          )}
                        </>
                      )}

                      {/* VIP extras */}
                      {vip && (vipMenu.appetisers?.length > 0 || vipMenu.desserts?.length > 0) && (
                        <div className="mt-3 rounded-xl border border-primary-100 bg-primary-50/60 p-3">
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-primary-600">
                            VIP extras
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="mb-1 block text-[10px] font-medium text-slate-500">
                                Appetiser
                              </label>
                              <select
                                value={row.appetiser}
                                onChange={(e) => updateRow(idx, "appetiser", e.target.value)}
                                disabled={!row.include}
                                className="w-full rounded-xl border border-primary-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary-400"
                              >
                                <option value="">None</option>
                                {(vipMenu.appetisers || []).map((item) => (
                                  <option key={item.code} value={item.name}>
                                    {item.code}. {item.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block text-[10px] font-medium text-slate-500">
                                Dessert
                              </label>
                              <select
                                value={row.dessert}
                                onChange={(e) => updateRow(idx, "dessert", e.target.value)}
                                disabled={!row.include}
                                className="w-full rounded-xl border border-primary-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary-400"
                              >
                                <option value="">None</option>
                                {(vipMenu.desserts || []).map((item) => (
                                  <option key={item.code} value={item.name}>
                                    {item.code}. {item.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      <details className="mt-3">
                        <summary className="cursor-pointer list-none text-[10px] font-semibold uppercase tracking-widest text-slate-400 select-none">
                          + Add note
                        </summary>
                        <div className="mt-2">
                          <input
                            value={row.notes}
                            onChange={(e) => updateRow(idx, "notes", e.target.value)}
                            disabled={!row.include}
                            placeholder="Optional note for kitchen…"
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                          />
                        </div>
                      </details>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {/* ─── Desktop table ─── */}
          <div className="hidden lg:block">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full table-fixed text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-left">
                      <th className="w-9 px-3 py-3">
                        <input
                          type="checkbox"
                          onChange={(e) =>
                            setRows((current) =>
                              current.map((row) => ({ ...row, include: e.target.checked }))
                            )
                          }
                          className="rounded border-slate-300 text-primary-600"
                        />
                      </th>
                      <th className="px-3 py-3 font-semibold text-slate-500">Patient</th>
                      <th className="px-3 py-3 font-semibold text-slate-500">Bed</th>
                      <th className="px-3 py-3 font-semibold text-slate-500">Class</th>
                      <th className="px-3 py-3 font-semibold text-slate-500">Main Meal</th>
                      <th className="px-3 py-3 font-semibold text-slate-500">Appetiser</th>
                      <th className="px-3 py-3 font-semibold text-slate-500">Dessert</th>
                      <th className="px-3 py-3 font-semibold text-slate-500">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row, idx) => {
                      const noMenu = menuItems.mains.length === 0;
                      const vip = isVipClass(row.patientClass);
                      const ngTube = row.patientClass === "NG_TUBE";

                      return (
                        <tr
                          key={row.patientId}
                          className={`transition-colors hover:bg-slate-50/70 ${row.include ? "" : "opacity-40"}`}
                        >
                          <td className="px-3 py-2.5">
                            <input
                              type="checkbox"
                              checked={row.include}
                              onChange={(e) => updateRow(idx, "include", e.target.checked)}
                              className="rounded border-slate-300 text-primary-600"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9px] font-bold text-slate-600">
                                {row.patientName?.[0]?.toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-800">{row.patientName}</p>
                                {row.isSpecialPatient && (
                                  <p className="text-[9px] text-primary-600">
                                    {row.specialMealType !== "NONE" ? row.specialMealType : "Special"}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">{row.bedNumber}</td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                                vip ? "bg-primary-50 text-primary-700" : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {row.patientClass}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            {ngTube ? (
                              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-semibold text-red-600">
                                NG Tube
                              </span>
                            ) : noMenu ? (
                              <span className="text-slate-400">—</span>
                            ) : (
                              <select
                                value={row.mainMeal}
                                onChange={(e) => updateRow(idx, "mainMeal", e.target.value)}
                                disabled={!row.include}
                                className="w-full min-w-0 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary-500"
                              >
                                <option value="">— Select —</option>
                                {menuItems.mains.map((meal) => (
                                  <option key={meal} value={meal}>
                                    {meal}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            {vip ? (
                              <select
                                value={row.appetiser}
                                onChange={(e) => updateRow(idx, "appetiser", e.target.value)}
                                disabled={!row.include}
                                className="w-full min-w-0 rounded-lg border border-primary-200 bg-primary-50 px-2 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary-400"
                              >
                                <option value="">— None —</option>
                                {(vipMenu.appetisers || []).map((item) => (
                                  <option key={item.code} value={item.name}>
                                    {item.code}. {item.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            {vip ? (
                              <select
                                value={row.dessert}
                                onChange={(e) => updateRow(idx, "dessert", e.target.value)}
                                disabled={!row.include}
                                className="w-full min-w-0 rounded-lg border border-primary-200 bg-primary-50 px-2 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary-400"
                              >
                                <option value="">— None —</option>
                                {(vipMenu.desserts || []).map((item) => (
                                  <option key={item.code} value={item.name}>
                                    {item.code}. {item.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              value={row.notes}
                              onChange={(e) => updateRow(idx, "notes", e.target.value)}
                              disabled={!row.include}
                              placeholder="Notes…"
                              className="w-full min-w-0 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary-500"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
        </>
      )}

      {/* ── Submit bar ── */}
      <div
        className="fixed left-4 right-4 z-30 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg shadow-slate-200/60 backdrop-blur-sm lg:static lg:mx-0"
        style={{ bottom: "calc(6rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-900">
                {selectedMeals} of {selectedPatients} ready
              </p>
              {selectedMeals > 0 && selectedMeals < selectedPatients && (
                <p className="text-[10px] font-medium text-amber-600">
                  {selectedPatients - selectedMeals} need a meal
                </p>
              )}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-primary-500 transition-all duration-300"
                style={{
                  width: `${selectedPatients > 0 ? (selectedMeals / selectedPatients) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting || selectedMeals === 0}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send size={13} />
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}

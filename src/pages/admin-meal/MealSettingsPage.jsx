import { useEffect, useRef, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../config/firebase";
import { Save, Info, Crown, CheckCircle2, AlertCircle } from "lucide-react";

const DAYS = ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"];

const DEFAULT_SETTINGS = {
  orderingEnabled: true,
  allowLateOrders: true,
  requireLateReason: true,
  supportContactNumber: "0000000000",
  breakfastOpenTime: "05:00",
  breakfastCutoffTime: "05:30",
  lunchOpenTime: "11:00",
  lunchCutoffTime: "11:30",
  supperOpenTime: "16:00",
  supperCutoffTime: "16:30",
  activeDays: ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"],
};

const DEFAULT_VIP = {
  appetisers: [
    { code: "A1", name: "Garden Salad" },
    { code: "A2", name: "Tuna Salad" },
    { code: "A3", name: "French Salad" },
    { code: "A4", name: "Mixed Salad" },
    { code: "A5", name: "Chicken Salad" },
  ],
  desserts: [
    { code: "D1", name: "Yoghurt" },
    { code: "D2", name: "Fruit Salad" },
    { code: "D3", name: "Coupe Jack" },
    { code: "D4", name: "Pancake" },
    { code: "D5", name: "Beetroot, Banana & Ginger Smoothie" },
    { code: "D6", name: "Orange, Carrot & Mango Smoothie" },
    { code: "D7", name: "Tropical Green" },
  ],
};

export default function MealSettingsPage() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  // VIP menu state
  const [vipMenu, setVipMenu] = useState(DEFAULT_VIP);

  useEffect(() => {
    async function load() {
      try {
        const [settingsSnap, vipSnap] = await Promise.all([
          getDoc(doc(db, "settings", "mealOrdering")),
          getDoc(doc(db, "settings", "vipMenu")),
        ]);
        if (settingsSnap.exists()) setSettings({ ...DEFAULT_SETTINGS, ...settingsSnap.data() });
        if (vipSnap.exists()) {
          const d = vipSnap.data();
          setVipMenu({
            appetisers: d.appetisers?.length ? d.appetisers : DEFAULT_VIP.appetisers,
            desserts:   d.desserts?.length   ? d.desserts   : DEFAULT_VIP.desserts,
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  function showToast(type, message) {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ type, message });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2600);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await Promise.all([
        setDoc(doc(db, "settings", "mealOrdering"), {
          ...settings,
          updatedAt: serverTimestamp(),
        }),
        setDoc(doc(db, "settings", "vipMenu"), {
          appetisers: vipMenu.appetisers,
          desserts:   vipMenu.desserts,
          updatedAt:  serverTimestamp(),
        }),
      ]);
      showToast("success", "Settings saved");
    } catch (err) {
      console.error(err);
      showToast("error", "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  function updateVipItem(group, idx, value) {
    setVipMenu(v => ({
      ...v,
      [group]: v[group].map((item, i) => i === idx ? { ...item, name: value } : item),
    }));
  }

  function toggleDay(day) {
    setSettings(s => ({
      ...s,
      activeDays: s.activeDays.includes(day)
        ? s.activeDays.filter(d => d !== day)
        : [...s.activeDays, day],
    }));
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-400 text-sm">Loading settings…</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <form onSubmit={handleSave} className="space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Meal Ordering Settings</h1>
            <p className="text-sm text-slate-500">Configure ordering windows and cutoff times</p>
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <button type="submit" disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-60 transition-colors shadow-sm">
              <Save size={15} /> {saving ? "Saving\u2026" : "Save All Settings"}
            </button>
            {toast && (
              <div
                className={`inline-flex items-center gap-2 self-end -mt-1 rounded-full px-3 py-1.5 shadow-sm border backdrop-blur-sm animate-fadeIn origin-top-right ${
                  toast.type === "success"
                    ? "bg-emerald-950/95 border-emerald-800 text-emerald-100"
                    : "bg-red-950/95 border-red-800 text-red-100"
                }`}
                role="status"
                aria-live="polite"
                >
                  {toast.type === "success" ? (
                    <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
                  ) : (
                    <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
                  )}
                <span className="text-xs font-medium whitespace-nowrap">
                  {toast.type === "success" ? "Saved" : "Save failed"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* General */}
        <Section title="General">
          <Toggle
            label="Enable meal ordering"
            description="Allow nurses to place meal orders from the portal"
            checked={settings.orderingEnabled}
            onChange={v => setSettings(s => ({ ...s, orderingEnabled: v }))}
          />
          <Toggle
            label="Allow late orders"
            description="Allow nurses to submit orders after the cutoff time (requires reason)"
            checked={settings.allowLateOrders}
            onChange={v => setSettings(s => ({ ...s, allowLateOrders: v }))}
          />
          <Toggle
            label="Require late order reason"
            description="Nurses must provide a reason when submitting after cutoff"
            checked={settings.requireLateReason}
            onChange={v => setSettings(s => ({ ...s, requireLateReason: v }))}
          />
        </Section>

        {/* Meal Periods */}
        <Section title="Meal Period Windows">
          <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2.5 mb-2">
            <Info size={13} className="mt-0.5 flex-shrink-0" />
            Orders placed after the cutoff time are marked as late.
          </div>
          {[
            { period: "Breakfast", openKey: "breakfastOpenTime", cutoffKey: "breakfastCutoffTime" },
            { period: "Lunch", openKey: "lunchOpenTime", cutoffKey: "lunchCutoffTime" },
            { period: "Supper", openKey: "supperOpenTime", cutoffKey: "supperCutoffTime" },
          ].map(({ period, openKey, cutoffKey }) => (
            <div key={period} className="grid grid-cols-3 gap-4 items-center py-2 border-b border-slate-100 last:border-0">
              <span className="text-sm font-medium text-slate-700">{period}</span>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Open at</label>
                <input type="time" value={settings[openKey]}
                  onChange={e => setSettings(s => ({ ...s, [openKey]: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Cutoff</label>
                <input type="time" value={settings[cutoffKey]}
                  onChange={e => setSettings(s => ({ ...s, [cutoffKey]: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>
          ))}
        </Section>

        {/* Active Days */}
        <Section title="Active Ordering Days">
          <p className="text-xs text-slate-500 mb-3">Nurses can place orders on these days only</p>
          <div className="flex flex-wrap gap-2">
            {DAYS.map(d => (
              <button key={d} type="button" onClick={() => toggleDay(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${settings.activeDays.includes(d) ? "bg-primary-600 text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                {d[0] + d.slice(1, 3).toLowerCase()}
              </button>
            ))}
          </div>
        </Section>

        <Section title="SMS Notifications">
          <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2.5">
            <Info size={13} className="mt-0.5 flex-shrink-0" />
            When an order is marked delivered, we queue an SMS for the patient and include this contact number for any issues.
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Issue contact number</label>
            <input
              type="tel"
              value={settings.supportContactNumber || ""}
              onChange={e => setSettings(s => ({ ...s, supportContactNumber: e.target.value }))}
              placeholder="e.g. 0000000000"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              This number will appear in the delivered SMS message until the SMS provider is configured.
            </p>
          </div>
        </Section>

        {/* VIP Food Menu */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Crown size={18} className="text-primary-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800">VIP / VVIP Food Menu</h2>
              <p className="text-xs text-slate-500 mt-0.5">Appetisers and desserts shown to VIP &amp; VVIP patients</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
            {/* Appetisers */}
            <div className="px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary-600 mb-4">Appetisers</p>
              <div className="space-y-3">
                {vipMenu.appetisers.map((item, idx) => (
                  <div key={item.code} className="flex items-center gap-3">
                    <span className="w-12 text-center text-xs font-bold text-primary-700 bg-primary-50 border border-primary-200 rounded-lg py-2 flex-shrink-0">
                      {item.code}
                    </span>
                    <input
                      type="text"
                      value={item.name}
                      onChange={e => updateVipItem("appetisers", idx, e.target.value)}
                      placeholder={`Appetiser ${item.code}`}
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-slate-50 focus:bg-white transition-colors"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Desserts */}
            <div className="px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-600 mb-4">Desserts</p>
              <div className="space-y-3">
                {vipMenu.desserts.map((item, idx) => (
                  <div key={item.code} className="flex items-center gap-3">
                    <span className="w-12 text-center text-xs font-bold text-violet-700 bg-violet-50 border border-violet-200 rounded-lg py-2 flex-shrink-0">
                      {item.code}
                    </span>
                    <input
                      type="text"
                      value={item.name}
                      onChange={e => updateVipItem("desserts", idx, e.target.value)}
                      placeholder={`Dessert ${item.code}`}
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-slate-50 focus:bg-white transition-colors"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </form>

      </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
        <h2 className="font-semibold text-slate-800 text-sm">{title}</h2>
      </div>
      <div className="px-5 py-4 space-y-4">{children}</div>
    </div>
  );
}

function Toggle({ label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {description && <p className="text-xs text-slate-500">{description}</p>}
      </div>
      <button type="button" onClick={() => onChange(!checked)}
        className={`relative flex-shrink-0 w-10 h-6 rounded-full transition-colors ${checked ? "bg-primary-600" : "bg-slate-200"}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

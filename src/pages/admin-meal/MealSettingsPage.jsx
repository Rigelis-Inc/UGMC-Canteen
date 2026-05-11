import { useEffect, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../config/firebase";
import { Save, Info } from "lucide-react";
import Layout from "../../components/layout/Layout";

const DAYS = ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"];

const DEFAULT_SETTINGS = {
  orderingEnabled: true,
  allowLateOrders: true,
  requireLateReason: true,
  breakfastOpenTime: "05:00",
  breakfastCutoffTime: "05:30",
  lunchOpenTime: "11:00",
  lunchCutoffTime: "11:30",
  supperOpenTime: "16:00",
  supperCutoffTime: "16:30",
  activeDays: ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"],
};

export default function MealSettingsPage() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, "settings", "mealOrdering"));
        if (snap.exists()) {
          setSettings({ ...DEFAULT_SETTINGS, ...snap.data() });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, "settings", "mealOrdering"), {
        ...settings,
        updatedAt: serverTimestamp(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
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
    return <Layout><div className="p-8 text-center text-slate-400 text-sm">Loading settings…</div></Layout>;
  }

  return (
    <Layout>
      <form onSubmit={handleSave} className="space-y-8 max-w-2xl">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Meal Ordering Settings</h1>
          <p className="text-sm text-slate-500">Configure ordering windows and cutoff times</p>
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

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-60 transition-colors shadow-sm">
            <Save size={15} /> {saving ? "Saving…" : "Save Settings"}
          </button>
          {saved && <span className="text-sm text-green-600">Settings saved ✓</span>}
        </div>
      </form>
    </Layout>
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

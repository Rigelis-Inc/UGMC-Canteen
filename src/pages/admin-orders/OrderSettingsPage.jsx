import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import Layout from "../../components/layout/Layout";
import { Loader2, Check, AlertCircle, Save } from "lucide-react";

const DEFAULT_SETTINGS = {
  orderingEnabled: true,
  openingTime: "07:00",
  closingTime: "18:00",
  deliveryEnabled: true,
  pickupEnabled: true,
  deliveryFee: 0,
  acceptedPaymentMethods: ["CASH_ON_DELIVERY", "PAY_AT_CANTEEN"],
  publicNotice: "Orders are available during canteen working hours.",
};

const PAYMENT_OPTIONS = [
  { value: "CASH_ON_DELIVERY", label: "Cash on Delivery" },
  { value: "PAY_AT_CANTEEN", label: "Pay at Canteen" },
  { value: "MOBILE_MONEY", label: "Mobile Money" },
];

export default function OrderSettingsPage() {
  const { userProfile } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    getDoc(doc(db, "settings", "orderSettings"))
      .then((snap) => {
        if (snap.exists()) setSettings({ ...DEFAULT_SETTINGS, ...snap.data() });
      })
      .catch(() => setError("Failed to load settings."))
      .finally(() => setLoading(false));
  }, []);

  const setField = (field) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const togglePaymentMethod = (method) => {
    setSettings((prev) => {
      const current = prev.acceptedPaymentMethods || [];
      const next = current.includes(method)
        ? current.filter((m) => m !== method)
        : [...current, method];
      return { ...prev, acceptedPaymentMethods: next };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await setDoc(
        doc(db, "settings", "orderSettings"),
        {
          ...settings,
          deliveryFee: parseFloat(settings.deliveryFee) || 0,
          updatedAt: serverTimestamp(),
          updatedBy: userProfile?.uid || null,
        },
        { merge: true }
      );
      setSuccess("Settings saved successfully.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error(err);
      setError("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1.5";

  const Toggle = ({ checked, onChange, label, description }) => (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange({ target: { type: "checkbox", checked: !checked } })}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${checked ? "bg-orange-500" : "bg-gray-200"}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Order Settings</h1>
            <p className="text-sm text-gray-500 mt-0.5">Configure the public food ordering website</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>

        {success && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4 text-green-700 text-sm">
            <Check size={15} /> {success}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-red-700 text-sm">
            <AlertCircle size={15} /> {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-orange-400" />
          </div>
        ) : (
          <div className="max-w-2xl space-y-5">
            {/* Ordering on/off */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-bold text-gray-900 mb-4">General</h2>
              <div className="space-y-4">
                <Toggle
                  checked={settings.orderingEnabled}
                  onChange={setField("orderingEnabled")}
                  label="Online Ordering Enabled"
                  description="When disabled, customers cannot place orders from the public website."
                />
                <Toggle
                  checked={settings.pickupEnabled}
                  onChange={setField("pickupEnabled")}
                  label="Pickup Available"
                  description="Allow customers to pick up orders at the canteen."
                />
                <Toggle
                  checked={settings.deliveryEnabled}
                  onChange={setField("deliveryEnabled")}
                  label="Delivery Available"
                  description="Allow hospital delivery and department/ward orders."
                />
              </div>
            </div>

            {/* Hours */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-bold text-gray-900 mb-4">Operating Hours</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Opening Time</label>
                  <input type="time" className={inputCls} value={settings.openingTime} onChange={setField("openingTime")} />
                </div>
                <div>
                  <label className={labelCls}>Closing Time</label>
                  <input type="time" className={inputCls} value={settings.closingTime} onChange={setField("closingTime")} />
                </div>
              </div>
            </div>

            {/* Delivery fee */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-bold text-gray-900 mb-4">Pricing</h2>
              <div>
                <label className={labelCls}>Delivery Fee (GH₵)</label>
                <input
                  type="number"
                  min="0"
                  step="0.50"
                  className={inputCls}
                  value={settings.deliveryFee}
                  onChange={setField("deliveryFee")}
                  placeholder="0.00"
                />
                <p className="text-xs text-gray-400 mt-1.5">Set to 0 for free delivery.</p>
              </div>
            </div>

            {/* Payment methods */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-bold text-gray-900 mb-4">Accepted Payment Methods</h2>
              <div className="space-y-3">
                {PAYMENT_OPTIONS.map((opt) => {
                  const checked = (settings.acceptedPaymentMethods || []).includes(opt.value);
                  return (
                    <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${checked ? "border-orange-400 bg-orange-50" : "border-gray-200 hover:border-gray-300"}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePaymentMethod(opt.value)}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${checked ? "bg-orange-500 border-orange-500" : "border-gray-300"}`}>
                        {checked && <Check size={10} className="text-white" />}
                      </div>
                      <span className={`text-sm font-medium ${checked ? "text-orange-700" : "text-gray-700"}`}>{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Public notice */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-bold text-gray-900 mb-4">Public Notice</h2>
              <label className={labelCls}>Message shown to customers when ordering is closed</label>
              <textarea
                className={`${inputCls} resize-none`}
                rows={3}
                value={settings.publicNotice}
                onChange={setField("publicNotice")}
                placeholder="e.g. Ordering is currently closed. Please check back during canteen working hours."
              />
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

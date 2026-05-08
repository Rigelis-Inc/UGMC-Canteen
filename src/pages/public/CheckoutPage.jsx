import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { collection, addDoc, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useCart } from "../../contexts/CartContext";
import { useSiteStatus } from "../../components/public/PublicLayout";
import { ChevronLeft, Loader2, AlertCircle, MapPin, User, MessageSquare, ShoppingBag } from "lucide-react";
import { buildPublicTrackingDoc, rememberCustomerOrder } from "../../lib/publicOrderTracking";

function generateOrderNumber() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `ORD-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { items, totalPrice, clearCart } = useCart();
  const { orderingEnabled } = useSiteStatus();
  const [form, setForm] = useState({
    customerName: "",
    phone: "",
    location: "",
    specialInstructions: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (items.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 bg-gray-950">
        <div className="w-16 h-16 rounded-2xl bg-gray-900 shadow-sm flex items-center justify-center mb-5">
          <AlertCircle size={28} className="text-gray-600" />
        </div>
        <h2 className="text-lg font-bold text-white mb-1">Your cart is empty</h2>
        <p className="text-sm text-gray-500 mb-6">Add some items before checking out.</p>
        <Link to="/menu" className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-semibold px-6 py-3 rounded-2xl transition-all text-sm">
          Browse Menu
        </Link>
      </div>
    );
  }

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.customerName.trim() || !form.phone.trim()) { setError("Please fill in your name and phone number."); return; }
    if (!form.location.trim()) { setError("Please enter your ward or department."); return; }
    setSubmitting(true);
    try {
      const settingsSnap = await getDoc(doc(db, "settings", "orderSettings"));
      if (settingsSnap.exists() && !settingsSnap.data().orderingEnabled) { setError("Ordering is currently closed."); setSubmitting(false); return; }
      const orderNumber = generateOrderNumber();
      const orderData = {
        orderNumber,
        customerName: form.customerName.trim(),
        phone: form.phone.trim(),
        deliveryLocation: form.location.trim(),
        items: items.map((i) => ({
          menuItemId: i.id,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          subtotal: i.price * i.quantity,
          imageUrl: i.imageUrl || null,
        })),
        subtotal: totalPrice,
        total: totalPrice,
        status: "PENDING",
        paymentStatus: "PENDING",
        specialInstructions: form.specialInstructions.trim(),
        receivedBy: null,
        receivedByName: null,
        handledBy: null,
        handledByName: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        confirmedAt: null,
        completedAt: null,
        cancelledAt: null,
      };
      const ref = await addDoc(collection(db, "foodOrders"), orderData);
      await setDoc(doc(db, "publicOrderTracking", ref.id), buildPublicTrackingDoc(ref.id, orderData));
      rememberCustomerOrder({ id: ref.id, orderNumber, customerName: orderData.customerName });
      clearCart();
      navigate(`/order-confirmation/${ref.id}`, { state: { order: { ...orderData, id: ref.id } } });
    } catch (err) {
      console.error("Checkout error:", err);
      setError(err?.message || "Failed to place order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = "w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-500 transition-all placeholder:text-gray-500";

  return (
    <div className="min-h-screen bg-gray-950 pb-40">
      <div className="max-w-xl mx-auto">

        {/* Header */}
        <div className="bg-gray-950 border-b border-gray-800 px-6 pt-5 pb-4 flex items-center gap-3">
          <Link to="/cart" className="p-2 -ml-2 rounded-xl hover:bg-gray-800 active:scale-95 transition-all">
            <ChevronLeft size={20} className="text-gray-400" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Checkout</h1>
            <p className="text-xs text-gray-500 mt-0.5">{items.length} item{items.length !== 1 ? "s" : ""} in your order</p>
          </div>
        </div>

        {/* Closed banner */}
        {!orderingEnabled && (
          <div className="px-6 pt-4">
            <div className="flex items-center gap-2 bg-amber-900/20 border border-amber-800/60 rounded-xl px-4 py-3 text-amber-400 text-xs font-semibold">
              <AlertCircle size={14} className="flex-shrink-0" />
              Ordering is currently closed
            </div>
          </div>
        )}

        {error && (
          <div className="px-6 pt-4">
            <div className="flex items-center gap-2 bg-red-900/20 border border-red-800/60 rounded-xl px-4 py-3 text-red-400 text-xs font-semibold">
              <AlertCircle size={14} className="flex-shrink-0" />
              {error}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="px-6 pt-5 space-y-6">

          {/* Your Details */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-orange-900/20 flex items-center justify-center">
                <User size={14} className="text-orange-500" />
              </div>
              <h2 className="text-sm font-bold text-white">Your Details</h2>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-400 mb-1.5 block">Full Name</label>
                <input required className={inputCls} value={form.customerName} onChange={set("customerName")} placeholder="e.g. Kwame Asante" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-400 mb-1.5 block">Phone Number</label>
                <input required className={inputCls} value={form.phone} onChange={set("phone")} placeholder="e.g. 0244 123 456" type="tel" />
              </div>
            </div>
          </div>

          {/* Delivery Location */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-orange-900/20 flex items-center justify-center">
                <MapPin size={14} className="text-orange-500" />
              </div>
              <h2 className="text-sm font-bold text-white">Ward / Department</h2>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400 mb-1.5 block">Where should we deliver?</label>
              <input required className={inputCls} value={form.location} onChange={set("location")} placeholder="e.g. Ward A, Room 5 or OPD" />
            </div>
          </div>

          {/* Special Instructions */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-orange-900/20 flex items-center justify-center">
                <MessageSquare size={14} className="text-orange-500" />
              </div>
              <h2 className="text-sm font-bold text-white">Special Instructions</h2>
            </div>
            <textarea className={`${inputCls} resize-none`} rows={3} value={form.specialInstructions} onChange={set("specialInstructions")} placeholder="Any dietary requirements or special requests..." />
          </div>

          {/* Order Summary */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingBag size={15} className="text-gray-500" />
              <h3 className="text-sm font-bold text-white">Order Summary</h3>
            </div>
            <div className="space-y-3 mb-4">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-bold text-gray-500 bg-gray-800 rounded-md px-2 py-0.5 flex-shrink-0">{item.quantity}×</span>
                    <span className="text-sm text-gray-300 truncate">{item.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-white flex-shrink-0 ml-3">GH₵ {(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-gray-800">
              <span className="text-sm font-bold text-white">Total</span>
              <div className="flex items-baseline gap-1">
                <span className="text-xs font-semibold text-gray-500">GH₵</span>
                <span className="text-xl font-black text-white tracking-tight">{totalPrice.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || !orderingEnabled}
            className="w-full bg-orange-500 hover:bg-orange-600 active:scale-[0.98] disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-4 rounded-2xl transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
            {submitting ? "Placing Order..." : "Place Order"}
          </button>
        </form>
      </div>
    </div>
  );
}

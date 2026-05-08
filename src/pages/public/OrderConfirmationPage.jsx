import { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../config/firebase";
import { CheckCircle2, Clock, UtensilsCrossed, Loader2, AlertCircle, ClipboardList, ArrowRight, MapPin } from "lucide-react";
import { rememberCustomerOrder } from "../../lib/publicOrderTracking";

const STATUS_LABELS = {
  PENDING: { label: "Order Received", color: "text-amber-400", bg: "bg-amber-900/20" },
  CONFIRMED: { label: "Confirmed", color: "text-orange-400", bg: "bg-orange-900/20" },
  PREPARING: { label: "Preparing", color: "text-purple-400", bg: "bg-purple-900/20" },
  READY: { label: "Ready for Delivery", color: "text-emerald-400", bg: "bg-emerald-900/20" },
  COMPLETED: { label: "Completed", color: "text-emerald-400", bg: "bg-emerald-900/20" },
  CANCELLED: { label: "Cancelled", color: "text-red-400", bg: "bg-red-900/20" },
};

export default function OrderConfirmationPage() {
  const { orderId } = useParams();
  const location = useLocation();
  const [order, setOrder] = useState(location.state?.order || null);
  const [loading, setLoading] = useState(!order);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!order) {
      getDoc(doc(db, "foodOrders", orderId))
        .then((snap) => {
          if (snap.exists()) {
            const nextOrder = { id: snap.id, ...snap.data() };
            setOrder(nextOrder);
            rememberCustomerOrder({ id: nextOrder.id, orderNumber: nextOrder.orderNumber, customerName: nextOrder.customerName });
          } else setError("Order not found.");
        })
        .catch(() => setError("Failed to load order."))
        .finally(() => setLoading(false));
    } else {
      rememberCustomerOrder({ id: order.id, orderNumber: order.orderNumber, customerName: order.customerName });
    }
  }, [orderId, order]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-gray-950">
        <Loader2 size={28} className="animate-spin text-orange-500" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 bg-gray-950">
        <AlertCircle size={32} className="text-red-400 mb-3" />
        <p className="text-gray-400 text-center">{error || "Order not found."}</p>
        <Link to="/" className="mt-4 text-orange-500 text-sm font-semibold">Go Home</Link>
      </div>
    );
  }

  const status = STATUS_LABELS[order.status] || STATUS_LABELS.PENDING;

  return (
    <div className="min-h-screen bg-gray-950">

      {/* Success header */}
      <div className="bg-emerald-900/20 px-6 pt-14 pb-10 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-900/40 flex items-center justify-center mx-auto mb-4 shadow-sm">
          <CheckCircle2 size={32} className="text-emerald-500" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">Order Placed!</h1>
        <p className="text-gray-400 text-sm">We've received your order and will start preparing it shortly.</p>
      </div>

      <div className="max-w-xl mx-auto px-6 -mt-5 pb-10 space-y-3">

        {/* Order number + status */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-0.5">Order Number</p>
            <p className="font-mono text-lg font-bold text-white">{order.orderNumber}</p>
          </div>
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${status.bg} ${status.color}`}>
            {status.label}
          </span>
        </div>

        {/* Items */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-3">Items</p>
          <div className="space-y-2.5">
            {(order.items || []).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0">
                      <UtensilsCrossed size={14} className="text-gray-600" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{item.name}</p>
                    <p className="text-xs text-gray-500">× {item.quantity}</p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-white flex-shrink-0 ml-3">GH₵ {Number(item.subtotal).toFixed(2)}</p>
              </div>
            ))}
          </div>
          <div className="flex justify-between pt-3 mt-3 border-t border-gray-800">
            <span className="text-sm font-semibold text-white">Total</span>
            <span className="text-lg font-bold text-white">GH₵ {Number(order.total).toFixed(2)}</span>
          </div>
        </div>

        {/* Delivery location */}
        {order.deliveryLocation && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4 flex items-start gap-3 shadow-sm">
            <div className="w-8 h-8 rounded-lg bg-orange-900/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <MapPin size={14} className="text-orange-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Deliver to</p>
              <p className="text-sm font-medium text-white">{order.deliveryLocation}</p>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="bg-orange-900/20 border border-orange-800/60 rounded-2xl p-4 flex items-start gap-3">
          <Clock size={15} className="text-orange-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-orange-400 leading-relaxed">
            Your order will be delivered to the ward or department you specified. We'll notify you when it's ready.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-2">
          <Link
            to={`/orders/${order.id}`}
            className="flex items-center justify-center gap-2 w-full bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-semibold py-3.5 rounded-2xl transition-all text-sm shadow-lg shadow-orange-500/20"
          >
            <ClipboardList size={15} />
            Track my order
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <Link
              to="/menu"
              className="flex items-center justify-center gap-1.5 bg-gray-900 border border-gray-700 hover:border-orange-800 hover:text-orange-400 active:scale-[0.98] text-white font-semibold py-3 rounded-2xl transition-all text-sm"
            >
              Order more
              <ArrowRight size={13} />
            </Link>
            <Link
              to="/"
              className="flex items-center justify-center bg-gray-900 border border-gray-700 hover:border-gray-600 active:scale-[0.98] text-gray-400 font-medium py-3 rounded-2xl transition-all text-sm"
            >
              Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

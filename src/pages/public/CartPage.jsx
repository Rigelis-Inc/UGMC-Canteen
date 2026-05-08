import { Link } from "react-router-dom";
import { useCart } from "../../contexts/CartContext";
import { Trash2, Plus, Minus, UtensilsCrossed, ArrowRight } from "lucide-react";

export default function CartPage() {
  const { items, totalItems, totalPrice, removeItem, updateQuantity, clearCart } = useCart();

  if (items.length === 0) {
    return (
      <div className="min-h-[75vh] flex flex-col items-center justify-center px-6 bg-gray-950">
        <div className="w-16 h-16 rounded-2xl bg-gray-900 shadow-sm flex items-center justify-center mb-5">
          <UtensilsCrossed size={28} className="text-gray-600" />
        </div>
        <h2 className="text-xl font-bold text-white mb-1.5">Your cart is empty</h2>
        <p className="text-gray-500 text-sm mb-8 text-center max-w-xs">Browse our menu and add some delicious meals.</p>
        <Link to="/menu" className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-semibold px-6 py-3 rounded-2xl transition-all shadow-lg shadow-orange-500/20">
          Browse Menu
          <ArrowRight size={14} />
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-3xl mx-auto px-6 sm:px-8 pb-36">

        {/* Header */}
        <div className="pt-6 pb-4">
          <h1 className="text-2xl font-bold text-white tracking-tight">Your Cart</h1>
          <p className="text-sm text-gray-500 mt-0.5">{totalItems} item{totalItems !== 1 ? "s" : ""}</p>
        </div>

        {/* Items */}
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3.5 bg-gray-900 rounded-2xl border border-gray-800 p-3 shadow-sm">
              {/* Image */}
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.name} className="w-[60px] h-[60px] rounded-xl object-cover flex-shrink-0 bg-gray-800" />
              ) : (
                <div className="w-[60px] h-[60px] rounded-xl bg-gray-800 flex items-center justify-center flex-shrink-0">
                  <UtensilsCrossed size={18} className="text-gray-700" />
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white leading-tight truncate">{item.name}</h3>
                <p className="text-sm font-bold text-white mt-0.5">{formatMoney(item.price)}</p>
              </div>

              {/* Quantity + Remove */}
              <div className="flex flex-col items-end gap-2">
                <button onClick={() => removeItem(item.id)} className="text-gray-600 hover:text-red-500 active:scale-90 transition-all p-1">
                  <Trash2 size={13} />
                </button>
                <div className="flex items-center bg-gray-800 rounded-lg overflow-hidden">
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="w-8 h-8 flex items-center justify-center hover:bg-gray-700 active:scale-90 transition-all"
                  >
                    <Minus size={13} className="text-gray-400" />
                  </button>
                  <span className="text-sm font-bold text-white min-w-[24px] text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="w-8 h-8 flex items-center justify-center hover:bg-gray-700 active:scale-90 transition-all"
                  >
                    <Plus size={13} className="text-gray-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Clear cart */}
        <button onClick={clearCart} className="text-xs text-gray-500 hover:text-red-500 font-medium py-3 transition-colors">
          Clear cart
        </button>
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-950/90 backdrop-blur-xl border-t border-gray-800 px-6 sm:px-8 py-4 z-30">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400">Subtotal</span>
            <span className="text-lg font-bold text-white">{formatMoney(totalPrice)}</span>
          </div>
          <Link
            to="/checkout"
            className="flex items-center justify-center gap-2 w-full bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-semibold py-3.5 rounded-2xl transition-all text-sm shadow-lg shadow-orange-500/20"
          >
            Checkout
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  );
}

function formatMoney(value) {
  return `GH₵ ${Number(value || 0).toFixed(2)}`;
}

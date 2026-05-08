import { useEffect, useState, useMemo, useRef } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useCart } from "../../contexts/CartContext";
import { useSiteStatus } from "../../components/public/PublicLayout";
import { Search, Loader2, AlertCircle, UtensilsCrossed, Plus, Flame, Sparkles } from "lucide-react";

export default function MenuPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [flyingItems, setFlyingItems] = useState([]);
  const { orderingEnabled } = useSiteStatus();
  const { addItem } = useCart();
  const flyIdRef = useRef(0);

  useEffect(() => {
    getDocs(query(collection(db, "menuItems"), where("isActive", "==", true)))
      .then((snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch(() => setError("Failed to load menu."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchSearch = !search || item.name?.toLowerCase().includes(search.toLowerCase());
      return matchSearch;
    });
  }, [items, search]);

  function handleAdd(item, e) {
    addItem(item);

    const btn = e.currentTarget;
    const cartBtn = document.querySelector('[data-cart-button]');
    if (!cartBtn) {
      btn.animate([{ transform: "scale(1)" }, { transform: "scale(0.8)" }, { transform: "scale(1)" }], { duration: 350, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" });
      return;
    }

    const btnRect = btn.getBoundingClientRect();
    const cartRect = cartBtn.getBoundingClientRect();

    const startX = btnRect.left + btnRect.width / 2;
    const startY = btnRect.top + btnRect.height / 2;
    const endX = cartRect.left + cartRect.width / 2;
    const endY = cartRect.top + cartRect.height / 2;

    const id = ++flyIdRef.current;
    setFlyingItems((prev) => [...prev, { id, startX, startY, endX, endY, imageUrl: item.imageUrl }]);

    setTimeout(() => {
      setFlyingItems((prev) => prev.filter((f) => f.id !== id));
    }, 750);

    btn.animate([{ transform: "scale(1)" }, { transform: "scale(0.8)" }, { transform: "scale(1)" }], { duration: 350, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-orange-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6">
        <AlertCircle size={24} className="text-red-400 mb-3" />
        <p className="text-sm text-gray-400 text-center">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-6xl mx-auto">

      {/* ─── Search ───────────────── */}
      <div className="bg-gray-950/80 backdrop-blur-2xl border-b border-gray-800">
        <div className="px-4 sm:px-6 py-2.5">
          <div className="relative group">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-orange-500 transition-colors" />
            <input
              type="text"
              placeholder="Search the menu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-800/80 border border-transparent rounded-xl text-xs text-white placeholder:text-gray-500 focus:outline-none focus:bg-gray-800 focus:border-gray-700 focus:ring-4 focus:ring-orange-500/10 transition-all"
            />
          </div>
        </div>
      </div>

      {/* ─── Closed banner ────────────────────────────── */}
      {!orderingEnabled && (
        <div className="px-4 sm:px-6 pt-3">
          <div className="flex items-center gap-2 bg-amber-900/20 border border-amber-800/60 rounded-xl px-3.5 py-2.5 text-amber-400 text-[11px] font-medium">
            <AlertCircle size={13} className="flex-shrink-0" />
            Ordering is currently closed
          </div>
        </div>
      )}

      {/* ─── Menu grid ────────────────────────────────── */}
      <div className="px-4 sm:px-6 py-3 pb-24">
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-14 h-14 rounded-2xl bg-gray-800 flex items-center justify-center mx-auto mb-4">
              <Search size={20} className="text-gray-600" />
            </div>
            <p className="text-xs font-semibold text-white mb-1">No items found</p>
            <p className="text-[11px] text-gray-500">Try a different search term</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                {filtered.length} item{filtered.length !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map((item) => {
                const unavailable = !item.isAvailable;
                const isSpecial = item.isTodaySpecial;
                const isPopular = item.isPopular;
                return (
                  <div
                    key={item.id}
                    className={`group bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden shadow-sm hover:shadow-lg hover:shadow-black/50 hover:-translate-y-0.5 transition-all duration-300 ${unavailable ? "opacity-50 grayscale" : ""}`}
                  >
                    {/* Image */}
                    <div className="relative overflow-hidden">
                      <div className="aspect-[3/2]">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                            <UtensilsCrossed size={24} className="text-gray-700" />
                          </div>
                        )}
                      </div>

                      <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/15 to-transparent pointer-events-none" />

                      {/* Badges */}
                      <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
                        {isSpecial && (
                          <span className="inline-flex items-center gap-1 bg-orange-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-full shadow-md shadow-orange-500/25 uppercase tracking-wider">
                            <Sparkles size={7} />
                            Special
                          </span>
                        )}
                        {isPopular && (
                          <span className="inline-flex items-center gap-1 bg-gray-900/95 backdrop-blur-sm text-amber-400 text-[8px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                            <Flame size={7} className="fill-amber-400 text-amber-400" />
                            Popular
                          </span>
                        )}
                      </div>

                      {unavailable && (
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
                          <span className="bg-gray-900 text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg">Sold Out</span>
                        </div>
                      )}
                    </div>

                    {/* Body */}
                    <div className="p-3">
                      <h3 className="text-xs font-semibold text-white leading-tight line-clamp-1">{item.name}</h3>

                      <div className="flex items-end justify-between gap-2 mt-2.5">
                        <div className="flex items-baseline gap-0.5">
                          <span className="text-[9px] font-semibold text-gray-500">GH₵</span>
                          <span className="text-sm font-bold text-white tracking-tight leading-none">{Number(item.price).toFixed(2)}</span>
                        </div>

                        {unavailable || !orderingEnabled ? (
                          <span className="text-[9px] text-gray-500 font-semibold uppercase tracking-wider">{unavailable ? "Sold Out" : "Closed"}</span>
                        ) : (
                          <button
                            onClick={(e) => handleAdd(item, e)}
                            className="flex items-center gap-1 bg-orange-500 hover:bg-orange-600 active:scale-90 text-white text-[10px] font-semibold px-2.5 py-1.5 rounded-lg transition-all shadow-sm hover:shadow-lg hover:shadow-orange-500/20"
                          >
                            <Plus size={11} strokeWidth={2.5} />
                            Add
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
      </div>

      {/* Flying items to cart */}
      {flyingItems.map((fly) => (
        <FlyingDot key={fly.id} {...fly} />
      ))}
    </div>
  );
}

function FlyingDot({ startX, startY, endX, endY, imageUrl }) {
  const dotRef = useRef(null);

  useEffect(() => {
    if (!dotRef.current) return;

    const dx = endX - startX;
    const dy = endY - startY;

    dotRef.current.animate(
      [
        {
          transform: "translate(0, 0) scale(1)",
          opacity: 1,
        },
        {
          transform: `translate(${dx * 0.3}px, ${dy * 0.6 - 60}px) scale(1.2)`,
          opacity: 1,
          offset: 0.3,
        },
        {
          transform: `translate(${dx}px, ${dy}px) scale(0.3)`,
          opacity: 0.5,
        },
      ],
      { duration: 700, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", fill: "forwards" }
    );

    return () => {
      if (dotRef.current) dotRef.current.getAnimations().forEach((a) => a.cancel());
    };
  }, [startX, startY, endX, endY]);

  return (
    <div
      ref={dotRef}
      className="fixed z-[9999] pointer-events-none"
      style={{ left: startX, top: startY }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="w-10 h-10 rounded-full object-cover border-2 border-orange-500 shadow-lg shadow-orange-500/30"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-orange-500 shadow-lg shadow-orange-500/30 flex items-center justify-center">
          <Plus size={14} className="text-white" strokeWidth={3} />
        </div>
      )}
    </div>
  );
}

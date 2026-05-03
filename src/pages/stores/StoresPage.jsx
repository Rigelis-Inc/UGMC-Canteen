import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { Package, AlertTriangle, ArrowRight, Warehouse, TrendingDown } from "lucide-react";
import Layout from "../../components/layout/Layout";

export default function StoresPage() {
  const { userProfile, assignedStores } = useAuth();
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStores() {
      try {
        const storesSnap = await getDocs(collection(db, "stores"));
        const storesData = storesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        const filteredStores =
          assignedStores.length > 0 && !["SUPER_ADMIN", "ADMIN"].includes(userProfile?.role)
            ? storesData.filter((s) => assignedStores.includes(s.id))
            : storesData;

        const storeStats = await Promise.all(
          filteredStores.map(async (store) => {
            const spQuery = query(collection(db, "storeProducts"), where("storeId", "==", store.id));
            const spSnap = await getDocs(spQuery);
            let lowStock = 0;
            let outOfStock = 0;
            let totalValue = 0;
            spSnap.forEach((doc) => {
              const data = doc.data();
              if (data.quantityOnHand <= 0) outOfStock++;
              else if (data.reorderLevel && data.quantityOnHand <= data.reorderLevel) lowStock++;
              totalValue += data.totalValue || 0;
            });
            return { ...store, productCount: spSnap.size, lowStock, outOfStock, totalValue };
          })
        );

        setStores(storeStats);
      } catch (err) {
        console.error("Error fetching stores:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchStores();
  }, [userProfile, assignedStores]);

  return (
    <Layout>
      <div className="mb-6 animate-fadeIn">
        <h1 className="text-[22px] font-semibold text-gray-900 tracking-tight">Stores</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">Manage and monitor all inventory stores</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-5 animate-pulse">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-gray-100 rounded-lg"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-100 rounded w-28 mb-1.5"></div>
                  <div className="h-3 bg-gray-100 rounded w-20"></div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="h-14 bg-gray-50 rounded-md"></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-5 animate-fadeIn">
          {stores.map((store) => (
            <Link
              key={store.id}
              to={`/stores/${store.id}`}
              className="group bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all duration-150"
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-start gap-3.5">
                    <div className="w-11 h-11 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Warehouse size={20} className="text-gray-500" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 tracking-tight group-hover:text-gray-700 transition-colors">
                        {store.name}
                      </h2>
                      <p className="text-xs text-gray-400 mt-1">{store.description || store.code}</p>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all mt-2" />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-md bg-gray-50 border border-gray-100 p-2">
                    <div className="flex items-center gap-1 mb-1">
                      <Package size={11} className="text-gray-400" />
                      <span className="text-[10px] text-gray-500 font-medium">Products</span>
                    </div>
                    <p className="text-sm font-bold text-gray-900">{store.productCount}</p>
                  </div>
                  <div className="rounded-md bg-amber-50/60 border border-amber-100/60 p-2">
                    <div className="flex items-center gap-1 mb-1">
                      <TrendingDown size={11} className="text-amber-500" />
                      <span className="text-[10px] text-amber-600 font-medium">Low Stock</span>
                    </div>
                    <p className={`text-sm font-bold ${store.lowStock > 0 ? "text-amber-600" : "text-gray-400"}`}>
                      {store.lowStock}
                    </p>
                  </div>
                  <div className="rounded-md bg-red-50/60 border border-red-100/60 p-2">
                    <div className="flex items-center gap-1 mb-1">
                      <AlertTriangle size={11} className="text-red-400" />
                      <span className="text-[10px] text-red-500 font-medium">Out of Stock</span>
                    </div>
                    <p className={`text-sm font-bold ${store.outOfStock > 0 ? "text-red-600" : "text-gray-400"}`}>
                      {store.outOfStock}
                    </p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-400">Total Value</span>
                  <span className="text-xs font-semibold text-gray-700">
                    GH₵ {store.totalValue.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Layout>
  );
}

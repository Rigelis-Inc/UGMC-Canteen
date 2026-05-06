import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit, addDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { writeAuditLog } from "../../lib/audit";
import { Package, AlertTriangle, DollarSign, Warehouse, TrendingDown, ArrowLeft, ArrowUpToLine, Plus, Upload, Download, X, Loader2, PencilLine, ToggleLeft, ToggleRight } from "lucide-react";
import * as XLSX from "xlsx";
import Layout from "../../components/layout/Layout";
import ConfirmActionModal from "../../components/common/ConfirmActionModal";

export default function StoreDetailPage() {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const [store, setStore] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [recentMovements, setRecentMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedStatusProduct, setSelectedStatusProduct] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const storeRef = doc(db, "stores", storeId);
        const storeSnap = await getDoc(storeRef);
        if (storeSnap.exists()) {
          setStore({ id: storeSnap.id, ...storeSnap.data() });
        }

        const [productsSnap, categoriesSnap] = await Promise.all([
          getDocs(collection(db, "storeProducts")),
          getDocs(collection(db, "productCategories")),
        ]);
        const allProducts = productsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setProducts(allProducts.filter((p) => p.storeId === storeId));
        setCategories(categoriesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        const movementsQuery = query(
          collection(db, "stockMovements"),
          orderBy("createdAt", "desc"),
          limit(500)
        );
        const movementsSnap = await getDocs(movementsQuery);
        const allMovements = movementsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setRecentMovements(allMovements.filter((m) => m.storeId === storeId).slice(0, 20));
      } catch (err) {
        console.error("Error fetching store data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [storeId]);

  if (loading) {
    return (
      <Layout>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-48"></div>
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded-xl"></div>
        </div>
      </Layout>
    );
  }

  if (!store) {
    return (
      <Layout>
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Warehouse size={24} className="text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium">Store not found</p>
        </div>
      </Layout>
    );
  }

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "products", label: "Products" },
    { id: "movements", label: "Movements" },
  ];

  const lowStockCount = products.filter(
    (p) => p.quantityOnHand > 0 && p.reorderLevel && p.quantityOnHand <= p.reorderLevel
  ).length;
  const outOfStockCount = products.filter((p) => p.quantityOnHand <= 0).length;
  const totalValue = products.reduce((sum, p) => sum + (p.totalValue || 0), 0);

  function getCategoryName(categoryId) {
    return categories.find((category) => category.id === categoryId)?.name || categoryId || "—";
  }

  function openEditModal(product) {
    setSelectedProduct(product);
    setShowEditModal(true);
  }

  function openToggleProductStatusModal(product) {
    setSelectedStatusProduct(product);
    setShowStatusModal(true);
  }

  async function handleToggleProductStatus(product) {
    const nextIsActive = product.isActive === false;

    try {
      await updateDoc(doc(db, "storeProducts", product.id), {
        isActive: nextIsActive,
        updatedAt: serverTimestamp(),
      });

      await writeAuditLog(db, {
        action: nextIsActive ? "Store product reactivated" : "Store product deactivated",
        entityType: "storeProduct",
        entityId: product.id,
        storeId: store.id,
        storeName: store.name,
        description: `${nextIsActive ? "Reactivated" : "Deactivated"} ${product.productName} in ${store.name}`,
        metadata: {
          productName: product.productName,
          isActive: nextIsActive,
        },
        currentUser,
        userProfile,
      });

      setProducts((prev) =>
        prev.map((entry) =>
          entry.id === product.id
            ? {
                ...entry,
                isActive: nextIsActive,
              }
            : entry
        )
      );
    } catch (err) {
      console.error("Failed to update product status:", err);
    }
  }

  const typeConfig = {
    RECEIVE: { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500" },
    ISSUE: { bg: "bg-primary-100", text: "text-primary-700", dot: "bg-primary-500" },
    TRANSFER: { bg: "bg-purple-100", text: "text-purple-700", dot: "bg-purple-500" },
    ADJUSTMENT: { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" },
    DAMAGE: { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" },
    EXPIRY: { bg: "bg-orange-100", text: "text-orange-700", dot: "bg-orange-500" },
  };

  return (
    <Layout>
    <div className="mb-6 animate-fadeIn">
        <button
          onClick={() => navigate("/stores")}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3 transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Stores
        </button>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{store.name}</h1>
          <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${store.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
            {store.isActive ? "Active" : "Inactive"}
          </span>
        </div>
        <p className="text-[13px] text-gray-500">{store.description || store.code}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6 animate-fadeIn">
        <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm hover:border-gray-300 transition-all duration-200">
          <div className="flex items-start justify-between mb-2">
            <p className="text-xs font-medium text-gray-500">Total Products</p>
            <div className="p-1.5 rounded-md bg-primary-50">
              <Package size={14} className="text-primary-600" />
            </div>
          </div>
          <p className="text-xl font-bold text-gray-900 tracking-tight leading-none">{products.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm hover:border-gray-300 transition-all duration-200">
          <div className="flex items-start justify-between mb-2">
            <p className="text-xs font-medium text-gray-500">Low Stock</p>
            <div className="p-1.5 rounded-md bg-amber-50">
              <TrendingDown size={14} className="text-amber-600" />
            </div>
          </div>
          <p className="text-xl font-bold text-amber-600 tracking-tight leading-none">{lowStockCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm hover:border-gray-300 transition-all duration-200">
          <div className="flex items-start justify-between mb-2">
            <p className="text-xs font-medium text-gray-500">Out of Stock</p>
            <div className="p-1.5 rounded-md bg-red-50">
              <AlertTriangle size={14} className="text-red-600" />
            </div>
          </div>
          <p className="text-xl font-bold text-red-600 tracking-tight leading-none">{outOfStockCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm hover:border-gray-300 transition-all duration-200">
          <div className="flex items-start justify-between mb-2">
            <p className="text-xs font-medium text-gray-500">Stock Value</p>
            <div className="p-1.5 rounded-md bg-emerald-50">
              <DollarSign size={14} className="text-emerald-600" />
            </div>
          </div>
          <p className="text-xl font-bold text-emerald-600 tracking-tight leading-none">GH₵ {totalValue.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
      </div>

      <div className="animate-fadeIn">
        <div className="mb-6">
          <div className="inline-flex items-center border border-gray-200 bg-transparent px-1 py-1.5 rounded-2xl">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-primary-600 text-white"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "overview" && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Store Information</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <dt className="text-sm text-gray-500 mb-1">Store Name</dt>
                <dd className="text-sm font-medium text-gray-900">{store.name}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500 mb-1">Store Code</dt>
                <dd className="text-sm font-medium text-gray-900">{store.code}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500 mb-1">Description</dt>
                <dd className="text-sm font-medium text-gray-900">{store.description || "—"}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500 mb-1">Status</dt>
                <dd>
                  <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${store.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                    {store.isActive ? "Active" : "Inactive"}
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        )}

        {activeTab === "products" && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <p className="text-sm text-gray-500">{products.length} product(s) in this store</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Upload size={14} />
                  Upload
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 transition-colors"
                >
                  <Plus size={14} />
                  Add Product
                </button>
              </div>
            </div>
            {products.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Package size={24} className="text-gray-400" />
                </div>
                <p className="text-gray-500 font-medium">No products in this store yet</p>
                <p className="text-sm text-gray-400 mt-1">Add products to start tracking inventory</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50/80 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Product</th>
                      <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Category</th>
                      <th className="text-right px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Qty</th>
                      <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Unit</th>
                      <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Status</th>
                      <th className="text-right px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {products.map((product) => {
                      const isActive = product.isActive !== false;
                      const status =
                        !isActive
                          ? { label: "Inactive", color: "bg-gray-100 text-gray-600" }
                          : product.quantityOnHand <= 0
                          ? { label: "Out of Stock", color: "bg-red-100 text-red-700" }
                          : product.reorderLevel && product.quantityOnHand <= product.reorderLevel
                          ? { label: "Low Stock", color: "bg-amber-100 text-amber-700" }
                          : { label: "In Stock", color: "bg-green-100 text-green-700" };
                      return (
                        <tr key={product.id} className={`hover:bg-gray-50/50 transition-colors ${!isActive ? "opacity-70" : ""}`}>
                          <td className="px-6 py-4 font-medium text-gray-900">{product.productName}</td>
                          <td className="px-6 py-4 text-gray-500">{getCategoryName(product.categoryId)}</td>
                          <td className="px-6 py-4 text-right font-semibold text-gray-900">{product.quantityOnHand}</td>
                          <td className="px-6 py-4 text-gray-500">{product.unit}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${status.color}`}>
                              {status.label}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openEditModal(product)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-medium transition-colors"
                              >
                                <PencilLine size={13} />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => openToggleProductStatusModal(product)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                  isActive
                                    ? "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                    : "border border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                                }`}
                              >
                                {isActive ? <ToggleLeft size={13} /> : <ToggleRight size={13} />}
                                {isActive ? "Deactivate" : "Activate"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "movements" && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {recentMovements.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <ArrowUpToLine size={24} className="text-gray-400" />
                </div>
                <p className="text-gray-500 font-medium">No stock movements recorded yet</p>
                <p className="text-sm text-gray-400 mt-1">Movements will appear here when stock is received or issued</p>
              </div>
            ) : (
              <>
                <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-primary-50/50">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Total Movements</p>
                      <p className="text-lg font-bold text-gray-900">{recentMovements.length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Qty Received</p>
                      <p className="text-lg font-bold text-green-600">
                        +{recentMovements.filter((m) => m.type === "RECEIVE").reduce((s, m) => s + (m.quantity || 0), 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Qty Issued</p>
                      <p className="text-lg font-bold text-primary-600">
                        -{recentMovements.filter((m) => m.type === "ISSUE").reduce((s, m) => s + (m.quantity || 0), 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Net Value</p>
                      <p className={`text-lg font-bold ${
                        recentMovements.filter((m) => m.type === "RECEIVE").reduce((s, m) => s + (m.totalCost || 0), 0) -
                        recentMovements.filter((m) => m.type === "ISSUE").reduce((s, m) => s + (m.totalCost || 0), 0) >= 0
                          ? "text-emerald-600" : "text-red-600"
                      }`}>
                        GH₵ {(
                          recentMovements.filter((m) => m.type === "RECEIVE").reduce((s, m) => s + (m.totalCost || 0), 0) -
                          recentMovements.filter((m) => m.type === "ISSUE").reduce((s, m) => s + (m.totalCost || 0), 0)
                        ).toLocaleString("en-GH", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50/80 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Date</th>
                        <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Type</th>
                        <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Product</th>
                        <th className="text-right px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Qty</th>
                        <th className="text-right px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Unit Cost</th>
                        <th className="text-right px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Total Cost</th>
                        <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Ref #</th>
                        <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Party</th>
                        <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">By</th>
                        <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {recentMovements.map((movement) => {
                        const config = typeConfig[movement.type] || typeConfig.ADJUSTMENT;
                        const isNegative = ["ISSUE", "DAMAGE", "EXPIRY"].includes(movement.type);
                        const party = movement.recipientName || movement.supplierName || movement.fromStoreName || movement.toStoreName || "—";
                        return (
                          <tr key={movement.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-3 text-gray-500 whitespace-nowrap">
                              {movement.createdAt?.toDate?.()?.toLocaleDateString() || "N/A"}
                            </td>
                            <td className="px-6 py-3">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`}></span>
                                {movement.type}
                              </span>
                            </td>
                            <td className="px-6 py-3 font-medium text-gray-900">{movement.productName}</td>
                            <td className={`px-6 py-3 text-right font-semibold whitespace-nowrap ${isNegative ? "text-red-600" : "text-green-600"}`}>
                              {isNegative ? "-" : "+"}{movement.quantity} {movement.unit}
                            </td>
                            <td className="px-6 py-3 text-right text-gray-500">GH₵ {(movement.unitCost || 0).toFixed(2)}</td>
                            <td className="px-6 py-3 text-right font-medium text-gray-900">GH₵ {(movement.totalCost || 0).toFixed(2)}</td>
                            <td className="px-6 py-3 text-gray-500 font-mono text-xs">{movement.referenceNumber || "—"}</td>
                            <td className="px-6 py-3 text-gray-500">{party}</td>
                            <td className="px-6 py-3 text-gray-500">{movement.performedByName || "—"}</td>
                            <td className="px-6 py-3 text-gray-400 max-w-[180px] truncate">{movement.note || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {showAddModal && (
        <AddProductModal
          store={store}
          categories={categories}
          onClose={() => setShowAddModal(false)}
        />
      )}
      {showUploadModal && (
        <UploadProductsModal
          store={store}
          categories={categories}
          onClose={() => setShowUploadModal(false)}
        />
      )}
      {showEditModal && selectedProduct && (
        <EditProductModal
          store={store}
          categories={categories}
          product={selectedProduct}
          onClose={() => {
            setShowEditModal(false);
            setSelectedProduct(null);
          }}
          onSaved={(updatedProduct) => {
            setProducts((prev) => prev.map((entry) => (entry.id === updatedProduct.id ? updatedProduct : entry)));
            setShowEditModal(false);
            setSelectedProduct(null);
          }}
        />
      )}
      {showStatusModal && selectedStatusProduct && (
        <ConfirmActionModal
          open={showStatusModal}
          title={`${selectedStatusProduct.isActive === false ? "Activate" : "Deactivate"} product`}
          description={`${selectedStatusProduct.isActive === false ? "Reactivate" : "Deactivate"} "${selectedStatusProduct.productName}" in ${store.name}?`}
          confirmLabel={selectedStatusProduct.isActive === false ? "Activate" : "Deactivate"}
          tone={selectedStatusProduct.isActive === false ? "success" : "warning"}
          onCancel={() => {
            setShowStatusModal(false);
            setSelectedStatusProduct(null);
          }}
          onConfirm={async () => {
            if (!selectedStatusProduct) return;
            await handleToggleProductStatus(selectedStatusProduct);
            setShowStatusModal(false);
            setSelectedStatusProduct(null);
          }}
        />
      )}
    </Layout>
  );
}

function AddProductModal({ store, categories, onClose }) {
  const { currentUser, userProfile } = useAuth();
  const [formData, setFormData] = useState({
    name: "",
    categoryId: "",
    unit: "",
    quantity: "",
    reorderLevel: "",
    unitCost: "",
    batchNumber: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const normalizedName = formData.name.toLowerCase().trim();
      const productsRef = collection(db, "products");
      const existingQuery = query(productsRef, where("normalizedName", "==", normalizedName));
      const existingSnap = await getDocs(existingQuery);

      let productId;
      if (existingSnap.empty) {
        const newProduct = await addDoc(productsRef, {
          name: formData.name.trim(),
          normalizedName,
          categoryId: formData.categoryId,
          unit: formData.unit,
          description: "",
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        productId = newProduct.id;
      } else {
        productId = existingSnap.docs[0].id;
      }

      const storeProductRef = await addDoc(collection(db, "storeProducts"), {
        storeId: store.id,
        productId,
        productName: formData.name.trim(),
        categoryId: formData.categoryId,
        unit: formData.unit,
        quantityOnHand: parseInt(formData.quantity) || 0,
        reorderLevel: parseInt(formData.reorderLevel) || 0,
        batchNumber: formData.batchNumber || "",
        expiryDate: null,
        unitCost: parseFloat(formData.unitCost) || 0,
        totalValue: (parseFloat(formData.unitCost) || 0) * (parseInt(formData.quantity) || 0),
        locationNote: "",
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog(db, {
        action: "Store product created",
        entityType: "storeProduct",
        entityId: storeProductRef.id,
        storeId: store.id,
        storeName: store.name,
        description: `Added ${formData.name.trim()} to ${store.name}`,
        metadata: {
          categoryId: formData.categoryId,
          quantity: parseInt(formData.quantity) || 0,
          unitCost: parseFloat(formData.unitCost) || 0,
          productMasterCreated: existingSnap.empty,
        },
        currentUser,
        userProfile,
      });

      onClose();
      window.location.reload();
    } catch (err) {
      setError("Failed to add product. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Add Product</h2>
            <p className="text-sm text-gray-500 mt-0.5">Add to {store.name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Unit <span className="text-red-500">*</span></label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
                required
              >
                <option value="">Select unit</option>
                {["Unit", "Box", "Pack", "Carton", "Bottle", "Bag", "Piece", "Kg", "Litre", "Gallon", "Roll", "Tablet", "Vial", "Sachet"].map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Product Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
              placeholder="e.g. Examination Gloves"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantity <span className="text-red-500">*</span></label>
              <input
                type="number"
                min="0"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Reorder Level</label>
              <input
                type="number"
                min="0"
                value={formData.reorderLevel}
                onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Unit Cost (GH₵)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.unitCost}
                onChange={(e) => setFormData({ ...formData, unitCost: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Batch Number</label>
              <input
                type="text"
                value={formData.batchNumber}
                onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg text-sm font-semibold hover:from-primary-700 hover:to-primary-800 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Product"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UploadProductsModal({ store, categories, onClose }) {
  const { currentUser, userProfile } = useAuth();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState("upload");

  const requiredColumns = ["Product Name", "Category", "Unit", "Quantity"];

  function handleFileChange(e) {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const workbook = XLSX.read(evt.target.result, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (rawData.length === 0) {
          setError("The file is empty. Please add data and try again.");
          return;
        }

        const headers = Object.keys(rawData[0]);
        const missing = requiredColumns.filter((col) => !headers.includes(col));
        if (missing.length > 0) {
          setError(`Missing required columns: ${missing.join(", ")}`);
          return;
        }

        const parsed = [];
        const rowErrors = [];
        rawData.forEach((row, i) => {
          const name = String(row["Product Name"] || "").trim();
          const category = String(row["Category"] || "").trim();
          const unit = String(row["Unit"] || "").trim();
          const quantity = parseInt(row["Quantity"]);
          const reorderLevel = parseInt(row["Reorder Level"]) || 0;
          const unitCost = parseFloat(row["Unit Cost"]) || 0;
          const batchNumber = String(row["Batch Number"] || "").trim();
          const expiryDate = String(row["Expiry Date"] || "").trim();
          const supplierName = String(row["Supplier Name"] || "").trim();

          const rowErr = [];
          if (!name) rowErr.push("Product Name is required");
          if (!unit) rowErr.push("Unit is required");
          if (isNaN(quantity) || quantity < 0) rowErr.push("Quantity must be a valid number");

          if (rowErr.length > 0) {
            rowErrors.push({ row: i + 2, errors: rowErr, data: row });
          } else {
            parsed.push({ name, category, unit, quantity, reorderLevel, unitCost, batchNumber, expiryDate, supplierName });
          }
        });

        setPreview(parsed);
        setErrors(rowErrors);
        setFile(selectedFile);
        setStep("preview");
        setError("");
      } catch {
        setError("Failed to read the file. Please check the format and try again.");
      }
    };
    reader.readAsBinaryString(selectedFile);
  }

  async function handleImport() {
    setLoading(true);
    setError("");

    try {
      const importedItems = [];
      for (const item of preview) {
        const normalizedName = item.name.toLowerCase();
        const productsRef = collection(db, "products");
        const existingQuery = query(productsRef, where("normalizedName", "==", normalizedName));
        const existingSnap = await getDocs(existingQuery);

        let productId;
        if (existingSnap.empty) {
          const catMatch = categories.find((c) => c.name.toLowerCase() === item.category.toLowerCase());
          const newProduct = await addDoc(productsRef, {
            name: item.name,
            normalizedName,
            categoryId: catMatch?.id || "",
            unit: item.unit,
            description: "",
            isActive: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          productId = newProduct.id;
        } else {
          productId = existingSnap.docs[0].id;
        }

        importedItems.push({
          productName: item.name,
          quantity: item.quantity,
          unit: item.unit,
        });

        await addDoc(collection(db, "storeProducts"), {
          storeId: store.id,
          productId,
          productName: item.name,
          categoryId: categories.find((c) => c.name.toLowerCase() === item.category.toLowerCase())?.id || "",
          unit: item.unit,
          quantityOnHand: item.quantity,
          reorderLevel: item.reorderLevel,
          batchNumber: item.batchNumber || "",
          expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
          unitCost: item.unitCost,
          totalValue: item.unitCost * item.quantity,
          locationNote: "",
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      await writeAuditLog(db, {
        action: "Products imported",
        entityType: "storeProduct",
        storeId: store.id,
        storeName: store.name,
        description: `Imported ${importedItems.length} product(s) into ${store.name}`,
        metadata: {
          importedItems,
        },
        currentUser,
        userProfile,
      });
      onClose();
      window.location.reload();
    } catch (err) {
      setError("Failed to import products. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function downloadTemplate() {
    const template = [
      {
        "Product Name": "Examination Gloves",
        "Category": "Medical Consumables",
        "Unit": "Box",
        "Quantity": 100,
        "Reorder Level": 20,
        "Unit Cost": 15.5,
        "Batch Number": "BATCH-001",
        "Expiry Date": "2027-12-31",
        "Supplier Name": "MedSupply Ltd",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    XLSX.writeFile(wb, "UGMC_Product_Upload_Template.xlsx");
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Upload Products</h2>
            <p className="text-sm text-gray-500 mt-0.5">Import to {store.name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          {step === "upload" && (
            <div className="p-6 space-y-6">
              <div
                className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center hover:border-primary-300 hover:bg-primary-50/30 transition-colors cursor-pointer"
                onClick={() => document.getElementById("fileInput").click()}
              >
                <div className="w-14 h-14 rounded-xl bg-primary-50 flex items-center justify-center mx-auto mb-4">
                  <Upload size={24} className="text-primary-500" />
                </div>
                <p className="text-sm font-medium text-gray-900">
                  {file ? file.name : "Click to select a file"}
                </p>
                <p className="text-xs text-gray-500 mt-1">CSV, XLS, or XLSX files accepted</p>
                <input
                  id="fileInput"
                  type="file"
                  accept=".csv,.xls,.xlsx"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              <div className="bg-primary-50 border border-primary-100 rounded-xl p-4">
                <p className="text-sm font-medium text-primary-800 mb-2">Required columns:</p>
                <div className="flex flex-wrap gap-1.5">
                  {requiredColumns.map((col) => (
                    <span key={col} className="px-2 py-1 bg-primary-100 text-primary-700 rounded-md text-xs font-medium">
                      {col}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-primary-600 mt-3">
                  Optional: Reorder Level, Unit Cost, Batch Number, Expiry Date, Supplier Name
                </p>
              </div>

              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
              >
                <Download size={14} />
                Download template file
              </button>
            </div>
          )}

          {step === "preview" && (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{preview.length} valid rows</p>
                  {errors.length > 0 && (
                    <p className="text-xs text-red-500">{errors.length} row(s) with errors</p>
                  )}
                </div>
                <button
                  onClick={() => { setStep("upload"); setPreview([]); setErrors([]); setFile(null); }}
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Change file
                </button>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">#</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Product</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Category</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Unit</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-500">Qty</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-500">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {preview.slice(0, 50).map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50/50">
                        <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                        <td className="px-3 py-2 font-medium text-gray-900">{item.name}</td>
                        <td className="px-3 py-2 text-gray-500">{item.category || "—"}</td>
                        <td className="px-3 py-2 text-gray-500">{item.unit}</td>
                        <td className="px-3 py-2 text-right font-medium">{item.quantity}</td>
                        <td className="px-3 py-2 text-right text-gray-500">
                          {item.unitCost > 0 ? `GH₵ ${item.unitCost.toFixed(2)}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {errors.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-lg p-4">
                  <p className="text-sm font-medium text-red-800 mb-2">Invalid rows (will be skipped):</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {errors.map((err) => (
                      <p key={err.row} className="text-xs text-red-600">
                        Row {err.row}: {err.errors.join(", ")}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 border-t border-gray-100 p-6 pt-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          {step === "preview" && (
            <button
              onClick={handleImport}
              disabled={loading || preview.length === 0}
              className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload size={14} />
                  Import {preview.length} Products
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDateInput(value) {
  if (!value) return "";
  const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function EditProductModal({ store, categories, product, onClose, onSaved }) {
  const { currentUser, userProfile } = useAuth();
  const [formData, setFormData] = useState({
    categoryId: product.categoryId || "",
    unit: product.unit || "",
    reorderLevel: product.reorderLevel ?? 0,
    batchNumber: product.batchNumber || "",
    expiryDate: formatDateInput(product.expiryDate),
    locationNote: product.locationNote || "",
    isActive: product.isActive !== false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const updates = {
        categoryId: formData.categoryId,
        unit: formData.unit,
        reorderLevel: parseInt(formData.reorderLevel, 10) || 0,
        batchNumber: formData.batchNumber.trim(),
        expiryDate: formData.expiryDate ? new Date(formData.expiryDate) : null,
        locationNote: formData.locationNote.trim(),
        isActive: formData.isActive,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, "storeProducts", product.id), updates);

      await writeAuditLog(db, {
        action: "Store product updated",
        entityType: "storeProduct",
        entityId: product.id,
        storeId: store.id,
        storeName: store.name,
        description: `Updated ${product.productName} in ${store.name}`,
        metadata: {
          productName: product.productName,
          updates: {
            categoryId: formData.categoryId,
            unit: formData.unit,
            reorderLevel: parseInt(formData.reorderLevel, 10) || 0,
            batchNumber: formData.batchNumber.trim(),
            expiryDate: formData.expiryDate || null,
            locationNote: formData.locationNote.trim(),
            isActive: formData.isActive,
          },
        },
        currentUser,
        userProfile,
      });

      onSaved({
        ...product,
        ...updates,
      });
    } catch (err) {
      setError("Failed to update product. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Edit Product</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {product.productName} in {store.name}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
            <select
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Unit <span className="text-red-500">*</span></label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
                required
              >
                <option value="">Select unit</option>
                {["Unit", "Box", "Pack", "Carton", "Bottle", "Bag", "Piece", "Kg", "Litre", "Gallon", "Roll", "Tablet", "Vial", "Sachet"].map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Reorder Level</label>
              <input
                type="number"
                min="0"
                value={formData.reorderLevel}
                onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Batch Number</label>
              <input
                type="text"
                value={formData.batchNumber}
                onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Expiry Date</label>
              <input
                type="date"
                value={formData.expiryDate}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Location Note</label>
            <textarea
              value={formData.locationNote}
              onChange={(e) => setFormData({ ...formData, locationNote: e.target.value })}
              rows={3}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50 resize-none"
              placeholder="Optional location details"
            />
          </div>

          <label className="flex items-center justify-between gap-4 p-3 rounded-lg border border-gray-200 bg-gray-50/50">
            <div>
              <p className="text-sm font-medium text-gray-900">Active status</p>
              <p className="text-xs text-gray-500">Inactive products stay visible but cannot be used for new stock actions.</p>
            </div>
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
          </label>

          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg text-sm font-semibold hover:from-primary-700 hover:to-primary-800 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

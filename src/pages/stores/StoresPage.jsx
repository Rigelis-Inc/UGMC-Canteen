import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, query, where, addDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { hasPermission } from "../../lib/permissions";
import { Warehouse, ArrowRight, Plus, X, Loader2, Pencil } from "lucide-react";
import Layout from "../../components/layout/Layout";

export default function StoresPage() {
  const { userProfile, assignedStores } = useAuth();
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStore, setEditingStore] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({ name: "", description: "", code: "" });

  const canManage = hasPermission(userProfile?.role, "manageStores");

  async function fetchStores() {
    try {
      const storesSnap = await getDocs(collection(db, "stores"));
      const storesData = storesSnap.docs.map((storeDoc) => ({ id: storeDoc.id, ...storeDoc.data() }));

      const filteredStores =
        assignedStores.length > 0 && !["SUPER_ADMIN", "ADMIN"].includes(userProfile?.role)
          ? storesData.filter((store) => assignedStores.includes(store.id))
          : storesData;

      const storeStats = await Promise.all(
        filteredStores.map(async (store) => {
          const spQuery = query(collection(db, "storeProducts"), where("storeId", "==", store.id));
          const spSnap = await getDocs(spQuery);
          let lowStock = 0;
          let outOfStock = 0;
          let totalValue = 0;

          spSnap.forEach((productDoc) => {
            const data = productDoc.data();
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

  useEffect(() => {
    fetchStores();
  }, [userProfile, assignedStores]);

  async function handleCreateStore(e) {
    e.preventDefault();
    setFormError("");
    if (!form.name.trim()) {
      setFormError("Store name is required.");
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, "stores"), {
        name: form.name.trim(),
        description: form.description.trim(),
        code: form.code.trim() || form.name.trim().toUpperCase().replace(/\s+/g, "_"),
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setForm({ name: "", description: "", code: "" });
      setShowModal(false);
      setLoading(true);
      fetchStores();
    } catch (err) {
      setFormError("Failed to create store. Please try again.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function openEditModal(e, store) {
    e.preventDefault();
    e.stopPropagation();
    setEditingStore(store);
    setForm({ name: store.name || "", description: store.description || "", code: store.code || "" });
    setFormError("");
  }

  async function handleEditStore(e) {
    e.preventDefault();
    setFormError("");
    if (!form.name.trim()) {
      setFormError("Store name is required.");
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, "stores", editingStore.id), {
        name: form.name.trim(),
        description: form.description.trim(),
        code: form.code.trim() || form.name.trim().toUpperCase().replace(/\s+/g, "_"),
        updatedAt: serverTimestamp(),
      });
      setEditingStore(null);
      setForm({ name: "", description: "", code: "" });
      setLoading(true);
      fetchStores();
    } catch (err) {
      setFormError("Failed to update store. Please try again.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout>
      <div className="mb-6 flex items-start justify-between animate-fadeIn">
        <div>
          <h1 className="text-[22px] font-semibold text-gray-900 tracking-tight">Stores</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Manage and monitor all inventory stores</p>
        </div>
        {canManage && (
          <button
            onClick={() => {
              setShowModal(true);
              setFormError("");
              setForm({ name: "", description: "", code: "" });
            }}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
          >
            <Plus size={15} />
            New Store
          </button>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-gray-100 last:border-b-0">
              <div className="h-10 w-10 rounded-lg bg-gray-100 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="h-4 bg-gray-100 rounded w-44 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-28" />
              </div>
              <div className="hidden md:grid flex-1 max-w-2xl grid-cols-3 gap-3">
                {Array.from({ length: 3 }).map((__, j) => (
                  <div key={j} className="h-12 bg-gray-50 rounded-md" />
                ))}
              </div>
              <div className="hidden lg:block h-4 w-24 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="animate-fadeIn overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/80">
                <tr>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Store</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Code</th>
                  <th className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-500">Products</th>
                  <th className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-500">Low Stock</th>
                  <th className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-500">Out of Stock</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">Total Value</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stores.map((store) => (
                  <tr key={store.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-4">
                      <Link to={`/admin/stores/${store.id}`} className="flex items-center gap-3 group">
                        <div className="h-10 w-10 flex-shrink-0 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center">
                          <Warehouse size={18} className="text-gray-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 group-hover:text-primary-700 transition-colors truncate">{store.name}</p>
                          <p className="text-xs text-gray-400 truncate">{store.description || "No description"}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500">{store.code}</td>
                    <td className="px-5 py-4 text-center">
                      <span className="inline-flex min-w-10 justify-center rounded-full bg-gray-50 px-2.5 py-1 text-sm font-semibold text-gray-900">
                        {store.productCount}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span
                        className={`inline-flex min-w-10 justify-center rounded-full px-2.5 py-1 text-sm font-semibold ${
                          store.lowStock > 0 ? "bg-amber-50 text-amber-700" : "bg-gray-50 text-gray-400"
                        }`}
                      >
                        {store.lowStock}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span
                        className={`inline-flex min-w-10 justify-center rounded-full px-2.5 py-1 text-sm font-semibold ${
                          store.outOfStock > 0 ? "bg-red-50 text-red-700" : "bg-gray-50 text-gray-400"
                        }`}
                      >
                        {store.outOfStock}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right text-sm font-semibold text-gray-900">
                      GH₵ {store.totalValue.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {canManage && (
                          <button
                            onClick={(e) => openEditModal(e, store)}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                            title="Edit store"
                          >
                            Edit
                          </button>
                        )}
                        <Link
                          to={`/admin/stores/${store.id}`}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                        >
                          View <ArrowRight size={13} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editingStore && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditingStore(null);
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Edit Store</h2>
                <p className="text-sm text-gray-500 mt-0.5">Update details for {editingStore.name}</p>
              </div>
              <button
                onClick={() => setEditingStore(null)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditStore} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Store Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50 min-h-[88px]"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Code</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
                />
              </div>

              {formError && <p className="text-sm text-red-600">{formError}</p>}

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingStore(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Saving…
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Add Store</h2>
                <p className="text-sm text-gray-500 mt-0.5">Create a new inventory store</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateStore} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Store Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50 min-h-[88px]"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Code</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
                  placeholder="Optional"
                />
              </div>

              {formError && <p className="text-sm text-red-600">{formError}</p>}

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Creating…
                    </>
                  ) : (
                    "Create Store"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Store Modal */}
      {editingStore && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setEditingStore(null); }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Edit Store</h2>
                <p className="text-sm text-gray-500 mt-0.5">Update details for {editingStore.name}</p>
              </div>
              <button
                onClick={() => setEditingStore(null)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditStore} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Store Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Main Store"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. Primary storage facility"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Store Code</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="e.g. MAIN_STORE"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none"
                />
              </div>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingStore(null)}
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 transition-colors disabled:opacity-70 disabled:cursor-wait flex items-center justify-center gap-2"
                >
                  {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Store Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">New Store</h2>
                <p className="text-sm text-gray-500 mt-0.5">Add a new inventory store</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateStore} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Store Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Main Store"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. Primary storage facility"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Store Code <span className="text-gray-400 font-normal">(optional — auto-generated if blank)</span>
                </label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="e.g. MAIN_STORE"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none"
                />
              </div>
              {formError && (
                <p className="text-sm text-red-600">{formError}</p>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 transition-colors disabled:opacity-70 disabled:cursor-wait flex items-center justify-center gap-2"
                >
                  {saving ? <><Loader2 size={14} className="animate-spin" /> Creating…</> : "Create Store"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}

import { useState, useEffect, useRef } from "react";
import { collection, getDocs, addDoc, serverTimestamp, doc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { ArrowUpToLine, Loader2, CheckCircle2, AlertCircle, Search, ChevronDown, X, Package, Plus, Trash2, Minus } from "lucide-react";
import Layout from "../../components/layout/Layout";

export default function IssueStockPage() {
  const { userProfile, assignedStores, currentUser } = useAuth();
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    storeId: "",
    recipientId: "",
    note: "",
    referenceNumber: `ISS-${Date.now()}`,
  });
  const [items, setItems] = useState([]);
  const [productSearch, setProductSearch] = useState("");
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipientDropdownOpen, setRecipientDropdownOpen] = useState(false);
  const productRef = useRef(null);
  const recipientRef = useRef(null);

  useEffect(() => {
    async function fetchData() {
      const [storesSnap, productsSnap, recipientsSnap] = await Promise.all([
        getDocs(collection(db, "stores")),
        getDocs(collection(db, "storeProducts")),
        getDocs(collection(db, "recipients")),
      ]);
      let storesData = storesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (assignedStores.length > 0 && !["SUPER_ADMIN", "ADMIN"].includes(userProfile?.role)) {
        storesData = storesData.filter((s) => assignedStores.includes(s.id));
      }
      setStores(storesData);
      setProducts(productsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setRecipients(recipientsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }
    fetchData();
  }, [userProfile, assignedStores]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (productRef.current && !productRef.current.contains(e.target)) {
        setProductDropdownOpen(false);
      }
      if (recipientRef.current && !recipientRef.current.contains(e.target)) {
        setRecipientDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const storeProducts = products.filter((p) => p.storeId === formData.storeId);
  const filteredProducts = storeProducts.filter((p) =>
    p.productName.toLowerCase().includes(productSearch.toLowerCase()) && !items.find((i) => i.productId === p.id)
  );
  const filteredRecipients = recipients.filter((r) =>
    r.name.toLowerCase().includes(recipientSearch.toLowerCase())
  );
  const selectedRecipient = recipients.find((r) => r.id === formData.recipientId);

  function handleAddProduct(product) {
    setItems([...items, { productId: product.id, productName: product.productName, unit: product.unit, quantity: 1, unitCost: product.unitCost || 0, maxQty: product.quantityOnHand }]);
    setProductSearch("");
    setProductDropdownOpen(false);
  }

  function handleRemoveItem(index) {
    setItems(items.filter((_, i) => i !== index));
  }

  function handleItemChange(index, field, value) {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  }

  const totalItems = items.reduce((s, i) => s + (parseInt(i.quantity) || 0), 0);
  const allValid = items.length > 0 && formData.recipientId && items.every((i) => parseInt(i.quantity) > 0 && parseInt(i.quantity) <= i.maxQty);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (!formData.recipientId) {
      setError("Please select a recipient.");
      setLoading(false);
      return;
    }

    if (!allValid) {
      setError("Please enter valid quantities for all items.");
      setLoading(false);
      return;
    }

    const invalidItem = items.find((i) => parseInt(i.quantity) > i.maxQty);
    if (invalidItem) {
      setError(`"${invalidItem.productName}" exceeds available stock (${invalidItem.maxQty} ${invalidItem.unit}).`);
      setLoading(false);
      return;
    }

    try {
      const batch = writeBatch(db);
      const recipient = recipients.find((r) => r.id === formData.recipientId);
      const store = stores.find((s) => s.id === formData.storeId);

      for (const item of items) {
        const product = products.find((p) => p.id === item.productId);
        const currentQty = product?.quantityOnHand || 0;
        const quantity = parseInt(item.quantity);
        const newQty = currentQty - quantity;

        const movementRef = doc(collection(db, "stockMovements"));
        batch.set(movementRef, {
          type: "ISSUE",
          storeId: formData.storeId,
          storeName: store?.name || "",
          productId: product?.productId || item.productId,
          storeProductId: item.productId,
          productName: item.productName,
          quantity,
          previousQuantity: currentQty,
          newQuantity: newQty,
          unit: item.unit,
          supplierId: null,
          supplierName: null,
          recipientId: formData.recipientId,
          recipientName: recipient?.name || "",
          fromStoreId: null,
          toStoreId: null,
          batchNumber: product?.batchNumber || "",
          expiryDate: product?.expiryDate || null,
          unitCost: item.unitCost || 0,
          totalCost: (item.unitCost || 0) * quantity,
          note: formData.note || "",
          referenceNumber: formData.referenceNumber || `ISS-${Date.now()}`,
          documentUrl: null,
          status: "COMPLETED",
          performedBy: currentUser?.uid || "",
          performedByName: userProfile?.fullName || "",
          approvedBy: null,
          approvedByName: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const spRef = doc(db, "storeProducts", item.productId);
        batch.update(spRef, {
          quantityOnHand: newQty,
          totalValue: (item.unitCost || 0) * newQty,
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();

      setSuccess(`${items.length} item(s) issued successfully!`);
      setItems([]);
      setFormData({ ...formData, recipientId: "", note: "", referenceNumber: `ISS-${Date.now()}` });
    } catch (err) {
      setError("Failed to issue stock. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className="mb-6 animate-fadeIn">
        <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Issue Stock</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">Issue multiple products to departments and recipients</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg flex items-start gap-2 animate-fadeIn">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-100 text-green-700 text-sm rounded-lg flex items-start gap-2 animate-fadeIn">
          <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
        {/* Left Panel - Configuration */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-primary-50 to-indigo-50/50">
              <h2 className="text-sm font-semibold text-gray-900">Configuration</h2>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Store <span className="text-red-500">*</span></label>
                <select
                  value={formData.storeId}
                  onChange={(e) => { setFormData({ ...formData, storeId: e.target.value }); setItems([]); }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
                >
                  <option value="">Select store</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div ref={recipientRef}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Recipient <span className="text-red-500">*</span></label>
                {formData.recipientId ? (
                  <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-primary-50/50 text-sm">
                    <span className="font-medium text-gray-900 flex-1 truncate">{selectedRecipient?.name}</span>
                    <button
                      type="button"
                      onClick={() => { setFormData({ ...formData, recipientId: "" }); setRecipientSearch(""); }}
                      className="p-0.5 hover:bg-gray-200 rounded transition-colors"
                    >
                      <X size={14} className="text-gray-400" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={recipientSearch}
                      onChange={(e) => { setRecipientSearch(e.target.value); setRecipientDropdownOpen(true); }}
                      onFocus={() => setRecipientDropdownOpen(true)}
                      placeholder="Search recipients..."
                      className="w-full pl-9 pr-9 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
                    />
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    {recipientDropdownOpen && (
                      <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                        {filteredRecipients.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-gray-500 text-center">No recipients found</div>
                        ) : (
                          filteredRecipients.map((r) => (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => { setFormData({ ...formData, recipientId: r.id }); setRecipientSearch(""); setRecipientDropdownOpen(false); }}
                              className="w-full px-3 py-2 text-left hover:bg-primary-50 transition-colors flex items-center justify-between border-b border-gray-50 last:border-0"
                            >
                              <span className="font-medium text-gray-900 text-sm">{r.name}</span>
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{r.type || ""}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Reference Number</label>
                <input
                  type="text"
                  value={formData.referenceNumber}
                  onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Note</label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50 resize-none"
                  placeholder="Purpose for issuing stock"
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !allValid}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <ArrowUpToLine size={16} />
                Issue {items.length} Item{items.length !== 1 ? "s" : ""} ({totalItems} units)
              </>
            )}
          </button>
        </div>

        {/* Right Panel - Products */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col" style={{ minHeight: "calc(100vh - 200px)" }}>
            <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-primary-50 to-indigo-50/50 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Products ({items.length})</h2>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => setItems([])}
                  className="text-xs text-red-500 hover:text-red-700 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="p-4 border-b border-gray-100">
              <div ref={productRef} className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => { setProductSearch(e.target.value); setProductDropdownOpen(true); }}
                  onFocus={() => formData.storeId && setProductDropdownOpen(true)}
                  placeholder={formData.storeId ? "Search and click to add products..." : "Select a store first"}
                  disabled={!formData.storeId}
                  className="w-full pl-9 pr-9 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                {productDropdownOpen && formData.storeId && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-auto">
                    {filteredProducts.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-500 text-center">
                        {productSearch ? "No matching products" : "All products already added"}
                      </div>
                    ) : (
                      filteredProducts.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleAddProduct(p)}
                          className="w-full px-4 py-2.5 text-left hover:bg-primary-50 transition-colors flex items-center justify-between border-b border-gray-50 last:border-0"
                        >
                          <span className="font-medium text-gray-900 text-sm">{p.productName}</span>
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{p.quantityOnHand} {p.unit}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-16">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                    <Package size={24} className="text-gray-400" />
                  </div>
                  <p className="text-gray-500 font-medium">No products added yet</p>
                  <p className="text-sm text-gray-400 mt-1">Search above to add products to this issue</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                      <div className="p-1.5 rounded-md bg-primary-100 flex-shrink-0">
                        <Package size={14} className="text-primary-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.productName}</p>
                        <p className="text-xs text-gray-500">Available: {item.maxQty} {item.unit}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleItemChange(index, "quantity", Math.max(1, (parseInt(item.quantity) || 1) - 1))}
                          className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          <Minus size={14} className="text-gray-500" />
                        </button>
                        <input
                          type="number"
                          min="1"
                          max={item.maxQty}
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                          className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => handleItemChange(index, "quantity", Math.min(item.maxQty, (parseInt(item.quantity) || 1) + 1))}
                          className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          <Plus size={14} className="text-gray-500" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

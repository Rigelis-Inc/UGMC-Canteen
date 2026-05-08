import { useEffect, useRef, useState } from "react";
import { collection, doc, getDocs, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { writeAuditLog } from "../../lib/audit";
import {
  AlertCircle,
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Minus,
  Package,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import Layout from "../../components/layout/Layout";

const INITIAL_REFERENCE_NUMBER = `TRF-${Date.now()}`;

export default function TransferStockPage() {
  const { userProfile, assignedStores, currentUser } = useAuth();
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    fromStoreId: "",
    toStoreId: "",
    note: "",
    referenceNumber: INITIAL_REFERENCE_NUMBER,
  });
  const [items, setItems] = useState([]);
  const [productSearch, setProductSearch] = useState("");
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const productRef = useRef(null);

  useEffect(() => {
    async function fetchData() {
      const [storesSnap, productsSnap] = await Promise.all([
        getDocs(collection(db, "stores")),
        getDocs(collection(db, "storeProducts")),
      ]);

      let storesData = storesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (assignedStores.length > 0 && !["SUPER_ADMIN", "ADMIN"].includes(userProfile?.role)) {
        storesData = storesData.filter((store) => assignedStores.includes(store.id));
      }

      setStores(storesData);
      setProducts(productsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }

    fetchData();
  }, [userProfile, assignedStores]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (productRef.current && !productRef.current.contains(event.target)) {
        setProductDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fromStore = stores.find((store) => store.id === formData.fromStoreId);
  const toStore = stores.find((store) => store.id === formData.toStoreId);
  const sourceProducts = products.filter((product) => product.storeId === formData.fromStoreId);
  const filteredProducts = sourceProducts.filter(
    (product) =>
      product.productName.toLowerCase().includes(productSearch.toLowerCase()) &&
      !items.find((item) => item.productId === product.id)
  );

  function handleAddProduct(product) {
    setItems([
      ...items,
      {
        productId: product.id,
        productName: product.productName,
        unit: product.unit,
        quantity: 1,
        unitCost: product.unitCost || 0,
        maxQty: product.quantityOnHand,
      },
    ]);
    setProductSearch("");
    setProductDropdownOpen(false);
  }

  function handleRemoveItem(index) {
    setItems(items.filter((_, itemIndex) => itemIndex !== index));
  }

  function handleItemChange(index, field, value) {
    const nextItems = [...items];
    nextItems[index] = { ...nextItems[index], [field]: value };
    setItems(nextItems);
  }

  const totalItems = items.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);
  const allValid =
    items.length > 0 &&
    formData.fromStoreId &&
    formData.toStoreId &&
    formData.fromStoreId !== formData.toStoreId &&
    items.every((item) => parseInt(item.quantity) > 0 && parseInt(item.quantity) <= item.maxQty);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (!formData.fromStoreId || !formData.toStoreId) {
      setError("Please select both source and destination stores.");
      setLoading(false);
      return;
    }

    if (formData.fromStoreId === formData.toStoreId) {
      setError("Source and destination stores must be different.");
      setLoading(false);
      return;
    }

    if (!allValid) {
      setError("Please enter valid quantities for all items.");
      setLoading(false);
      return;
    }

    const invalidItem = items.find((item) => parseInt(item.quantity) > item.maxQty);
    if (invalidItem) {
      setError(`"${invalidItem.productName}" exceeds available stock (${invalidItem.maxQty} ${invalidItem.unit}).`);
      setLoading(false);
      return;
    }

    try {
      const referenceNumber = formData.referenceNumber || `TRF-${Date.now()}`;

      await runTransaction(db, async (transaction) => {
        for (const item of items) {
          const sourceRef = doc(db, "storeProducts", item.productId);
          const sourceSnap = await transaction.get(sourceRef);

          if (!sourceSnap.exists()) {
            throw new Error(`Missing source stock for ${item.productName}.`);
          }

          const sourceProduct = sourceSnap.data();
          const quantity = parseInt(item.quantity);
          const sourceQty = sourceProduct.quantityOnHand || 0;
          if (quantity > sourceQty) {
            throw new Error(`"${item.productName}" exceeds available stock (${sourceQty} ${item.unit}).`);
          }

          const unitCost = parseFloat(sourceProduct.unitCost) || 0;
          const destinationMatch = products.find(
            (product) =>
              product.storeId === formData.toStoreId &&
              product.productId === sourceProduct.productId &&
              (product.batchNumber || "") === (sourceProduct.batchNumber || "")
          );
          const destinationRef = destinationMatch
            ? doc(db, "storeProducts", destinationMatch.id)
            : doc(collection(db, "storeProducts"));
          const destinationSnap = destinationMatch ? await transaction.get(destinationRef) : null;
          const destinationQty = destinationSnap?.exists() ? (destinationSnap.data().quantityOnHand || 0) : 0;
          const newSourceQty = sourceQty - quantity;
          const newDestinationQty = destinationQty + quantity;

          transaction.update(sourceRef, {
            quantityOnHand: newSourceQty,
            totalValue: unitCost * newSourceQty,
            updatedAt: serverTimestamp(),
          });

          if (destinationMatch && destinationSnap?.exists()) {
            transaction.update(destinationRef, {
              quantityOnHand: newDestinationQty,
              totalValue: unitCost * newDestinationQty,
              updatedAt: serverTimestamp(),
            });
          } else {
            transaction.set(destinationRef, {
              storeId: formData.toStoreId,
              productId: sourceProduct.productId,
              productName: sourceProduct.productName,
              categoryId: sourceProduct.categoryId || "",
              unit: sourceProduct.unit,
              quantityOnHand: quantity,
              reorderLevel: sourceProduct.reorderLevel || 0,
              batchNumber: sourceProduct.batchNumber || "",
              expiryDate: sourceProduct.expiryDate || null,
              unitCost,
              totalValue: unitCost * quantity,
              locationNote: "",
              isActive: true,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }

          const movementRef = doc(collection(db, "stockMovements"));
          transaction.set(movementRef, {
            type: "TRANSFER",
            storeId: formData.fromStoreId,
            storeName: fromStore?.name || "",
            productId: sourceProduct.productId,
            storeProductId: sourceProduct.id,
            productName: sourceProduct.productName,
            quantity,
            previousQuantity: sourceQty,
            newQuantity: newSourceQty,
            unit: sourceProduct.unit,
            supplierId: null,
            supplierName: null,
            recipientId: null,
            recipientName: null,
            fromStoreId: formData.fromStoreId,
            fromStoreName: fromStore?.name || "",
            toStoreId: formData.toStoreId,
            toStoreName: toStore?.name || "",
            batchNumber: sourceProduct.batchNumber || "",
            expiryDate: sourceProduct.expiryDate || null,
            unitCost,
            totalCost: unitCost * quantity,
            note: formData.note || "",
            referenceNumber,
            documentUrl: null,
            status: "COMPLETED",
            performedBy: currentUser?.uid || "",
            performedByName: userProfile?.fullName || "",
            approvedBy: null,
            approvedByName: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      });
      await writeAuditLog(db, {
        action: "Stock transferred",
        entityType: "stockMovement",
        storeId: formData.fromStoreId,
        storeName: fromStore?.name || "",
        description: `Transferred ${items.length} item(s) from ${fromStore?.name || "source store"} to ${toStore?.name || "destination store"}`,
        metadata: {
          referenceNumber: formData.referenceNumber || `TRF-${Date.now()}`,
          fromStoreId: formData.fromStoreId,
          toStoreId: formData.toStoreId,
          items: items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            quantity: parseInt(item.quantity),
            unit: item.unit,
          })),
        },
        currentUser,
        userProfile,
      });

      setSuccess(`${items.length} item(s) transferred successfully!`);
      setItems([]);
      setFormData({
        fromStoreId: "",
        toStoreId: "",
        note: "",
        referenceNumber: `TRF-${Date.now()}`,
      });
    } catch (transferError) {
      setError("Failed to transfer stock. Please try again.");
      console.error(transferError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className="mb-6 animate-fadeIn">
        <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Transfer Stock</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">Move stock between stores</p>
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
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-amber-50/50">
              <h2 className="text-sm font-semibold text-gray-900">Configuration</h2>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">From Store <span className="text-red-500">*</span></label>
                <select
                  value={formData.fromStoreId}
                  onChange={(e) => {
                    setFormData({ ...formData, fromStoreId: e.target.value });
                    setItems([]);
                  }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-gray-50/50"
                >
                  <option value="">Select source store</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">To Store <span className="text-red-500">*</span></label>
                <select
                  value={formData.toStoreId}
                  onChange={(e) => setFormData({ ...formData, toStoreId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-gray-50/50"
                >
                  <option value="">Select destination store</option>
                  {stores
                    .filter((store) => store.id !== formData.fromStoreId)
                    .map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Reference Number</label>
                <input
                  type="text"
                  value={formData.referenceNumber}
                  onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-gray-50/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Note</label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-gray-50/50 resize-none"
                  placeholder="Optional note about this transfer"
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !allValid}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <ArrowUpDown size={16} />
                Transfer {items.length} Item{items.length !== 1 ? "s" : ""} ({totalItems} units)
              </>
            )}
          </button>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col" style={{ minHeight: "calc(100vh - 200px)" }}>
            <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-amber-50/50 flex items-center justify-between">
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
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setProductDropdownOpen(true);
                  }}
                  onFocus={() => formData.fromStoreId && setProductDropdownOpen(true)}
                  placeholder={formData.fromStoreId ? "Search and click to add products..." : "Select a source store first"}
                  disabled={!formData.fromStoreId}
                  className="w-full pl-9 pr-9 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-gray-50/50 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                {productDropdownOpen && formData.fromStoreId && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-auto">
                    {filteredProducts.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-500 text-center">
                        {productSearch ? "No matching products" : "All products already added"}
                      </div>
                    ) : (
                      filteredProducts.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => handleAddProduct(product)}
                          className="w-full px-4 py-2.5 text-left hover:bg-orange-50 transition-colors flex items-center justify-between border-b border-gray-50 last:border-0"
                        >
                          <span className="font-medium text-gray-900 text-sm">{product.productName}</span>
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                            {product.quantityOnHand} {product.unit}
                          </span>
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
                  <p className="text-sm text-gray-400 mt-1">Search above to add products to this transfer</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-1.5 rounded-md bg-orange-100 flex-shrink-0">
                          <Package size={14} className="text-orange-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{item.productName}</p>
                          <p className="text-xs text-gray-500">Available: {item.maxQty} {item.unit}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Quantity</label>
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
                              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => handleItemChange(index, "quantity", Math.min(item.maxQty, (parseInt(item.quantity) || 1) + 1))}
                            className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                              <Plus size={14} className="text-gray-500" />
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Unit Cost</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitCost}
                            onChange={(e) => handleItemChange(index, "unitCost", e.target.value)}
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white"
                          />
                        </div>
                      </div>
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


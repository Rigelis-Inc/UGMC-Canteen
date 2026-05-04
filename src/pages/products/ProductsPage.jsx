import { useState, useEffect } from "react";
import { collection, getDocs, query, where, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { Search, Plus, Filter, X, Package, Loader2, Upload, Download } from "lucide-react";
import * as XLSX from "xlsx";
import Layout from "../../components/layout/Layout";

export default function ProductsPage() {
  const { userProfile, assignedStores } = useAuth();
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStore, setFilterStore] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        const [storesSnap, categoriesSnap] = await Promise.all([
          getDocs(collection(db, "stores")),
          getDocs(collection(db, "productCategories")),
        ]);
        setStores(storesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setCategories(categoriesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        let spQuery = collection(db, "storeProducts");
        if (assignedStores.length > 0 && !["SUPER_ADMIN", "ADMIN"].includes(userProfile?.role)) {
          spQuery = query(collection(db, "storeProducts"), where("storeId", "in", assignedStores));
        }
        const spSnap = await getDocs(spQuery);
        setProducts(spSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Error fetching products:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [userProfile, assignedStores]);

  const filtered = products.filter((p) => {
    if (searchTerm && !p.productName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filterStore && p.storeId !== filterStore) return false;
    if (filterCategory && p.categoryId !== filterCategory) return false;
    if (filterStatus) {
      const status =
        p.quantityOnHand <= 0
          ? "out"
          : p.reorderLevel && p.quantityOnHand <= p.reorderLevel
          ? "low"
          : "in";
      if (status !== filterStatus) return false;
    }
    return true;
  });

  function getStockStatus(p) {
    if (p.quantityOnHand <= 0) return { label: "Out of Stock", color: "bg-red-100 text-red-700" };
    if (p.reorderLevel && p.quantityOnHand <= p.reorderLevel)
      return { label: "Low Stock", color: "bg-amber-100 text-amber-700" };
    return { label: "In Stock", color: "bg-green-100 text-green-700" };
  }

  function getStoreName(storeId) {
    return stores.find((s) => s.id === storeId)?.name || storeId;
  }

  function getCategoryName(catId) {
    return categories.find((c) => c.id === catId)?.name || catId || "—";
  }

  const hasActiveFilters = filterStore || filterCategory || filterStatus;

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6 animate-fadeIn">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Products</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Manage inventory across all stores</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors shadow-sm"
          >
            <Upload size={15} />
            Upload
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm"
          >
            <Plus size={15} />
            Add Product
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 mb-6 animate-fadeIn">
        <div className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
              />
            </div>
            <div className="flex items-center gap-2 text-gray-400 px-2">
              <Filter size={16} />
            </div>
            <select
              value={filterStore}
              onChange={(e) => setFilterStore(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
            >
              <option value="">All Stores</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
            >
              <option value="">All Status</option>
              <option value="in">In Stock</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
            </select>
            {hasActiveFilters && (
              <button
                onClick={() => { setFilterStore(""); setFilterCategory(""); setFilterStatus(""); }}
                className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <X size={14} />
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-fadeIn">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 size={24} className="text-gray-400 animate-spin mx-auto mb-3" />
            <p className="text-gray-500">Loading products...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Package size={24} className="text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">
              {products.length === 0 ? "No products added yet" : "No products match your filters"}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {products.length === 0 ? "Add your first product to get started" : "Try adjusting your search or filters"}
            </p>
          </div>
        ) : (
          <>
            <div className="px-6 py-3 bg-gray-50/80 border-b border-gray-200 text-xs text-gray-500">
              Showing {filtered.length} of {products.length} products
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/80 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Product</th>
                    <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Store</th>
                    <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Category</th>
                    <th className="text-right px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Qty</th>
                    <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Unit</th>
                    <th className="text-right px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Unit Cost</th>
                    <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((product) => {
                    const status = getStockStatus(product);
                    return (
                      <tr key={product.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900">{product.productName}</td>
                        <td className="px-6 py-4 text-gray-500">{getStoreName(product.storeId)}</td>
                        <td className="px-6 py-4 text-gray-500">{getCategoryName(product.categoryId)}</td>
                        <td className="px-6 py-4 text-right font-semibold text-gray-900">{product.quantityOnHand}</td>
                        <td className="px-6 py-4 text-gray-500">{product.unit}</td>
                        <td className="px-6 py-4 text-right text-gray-500">
                          GH₵ {product.unitCost?.toFixed(2) || "0.00"}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${status.color}`}>
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {showAddModal && <AddProductModal stores={stores} categories={categories} onClose={() => setShowAddModal(false)} />}
      {showUploadModal && <UploadProductsModal stores={stores} categories={categories} onClose={() => setShowUploadModal(false)} />}
    </Layout>
  );
}

function AddProductModal({ stores, categories, onClose }) {
  const [formData, setFormData] = useState({
    name: "",
    categoryId: "",
    unit: "",
    storeId: "",
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

      await addDoc(collection(db, "storeProducts"), {
        storeId: formData.storeId,
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
            <p className="text-sm text-gray-500 mt-0.5">Add a new product to a store</p>
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Store <span className="text-red-500">*</span></label>
            <select
              value={formData.storeId}
              onChange={(e) => setFormData({ ...formData, storeId: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
              required
            >
              <option value="">Select store</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

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

function UploadProductsModal({ stores, categories, onClose }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [errors, setErrors] = useState([]);
  const [storeId, setStoreId] = useState("");
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
    if (!storeId) {
      setError("Please select a store for the products.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const batch = [];
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

        batch.push(
          addDoc(collection(db, "storeProducts"), {
            storeId,
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
          })
        );
      }

      await Promise.all(batch);
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
    <Layout>
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Upload Products</h2>
            <p className="text-sm text-gray-500 mt-0.5">Import products from CSV or Excel file</p>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Store <span className="text-red-500">*</span></label>
                <select
                  value={storeId}
                  onChange={(e) => setStoreId(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
                >
                  <option value="">Select store</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

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
    </Layout>
  );
}

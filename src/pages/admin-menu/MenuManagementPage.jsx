import { useState, useEffect } from "react";
import {
  collection, getDocs, updateDoc, doc, setDoc, serverTimestamp, query, where,
} from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import Layout from "../../components/layout/Layout";
import {
  Plus, Search, Pencil, Archive, Loader2, UtensilsCrossed, Upload, X, Check, AlertCircle, ImageIcon,
} from "lucide-react";

const EMPTY_FORM = {
  name: "",
  price: "",
  isAvailable: true,
  isPopular: false,
  isTodaySpecial: false,
};

export default function MenuManagementPage() {
  const { userProfile } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => { fetchItems(); }, []);

  async function fetchItems() {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "menuItems"), where("isActive", "==", true)));
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch {
      setError("Failed to load menu items.");
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setImageFile(null);
    setImagePreview(null);
    setError(null);
    setShowModal(true);
  }

  function openEdit(item) {
    setEditItem(item);
    setForm({
      name: item.name || "",
      price: item.price ?? "",
      isAvailable: item.isAvailable ?? true,
      isPopular: item.isPopular ?? false,
      isTodaySpecial: item.isTodaySpecial ?? false,
    });
    setImageFile(null);
    setImagePreview(item.imageUrl || null);
    setError(null);
    setShowModal(true);
  }

  function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function uploadImage(itemId) {
    if (!imageFile) return null;
    const ext = imageFile.name.split(".").pop();
    const path = `uploads/menu-items/${itemId}/${Date.now()}.${ext}`;
    const fileRef = storageRef(storage, path);
    return new Promise((resolve, reject) => {
      const task = uploadBytesResumable(fileRef, imageFile);
      task.on(
        "state_changed",
        (snap) => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        reject,
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve({ url, path });
        }
      );
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim() || !form.price) { setError("Name and price are required."); return; }
    setSaving(true);
    setUploadProgress(null);
    try {
      const base = {
        name: form.name.trim(),
        normalizedName: form.name.trim().toLowerCase(),
        price: parseFloat(form.price),
        isAvailable: form.isAvailable,
        isPopular: form.isPopular,
        isTodaySpecial: form.isTodaySpecial,
        updatedAt: serverTimestamp(),
      };

      if (editItem) {
        let imageData = {};
        if (imageFile) {
          const result = await uploadImage(editItem.id);
          if (result) imageData = { imageUrl: result.url, imagePath: result.path };
        }
        await updateDoc(doc(db, "menuItems", editItem.id), { ...base, ...imageData });
        setItems((prev) => prev.map((i) => i.id === editItem.id ? { ...i, ...base, ...imageData } : i));
      } else {
        const itemRef = doc(collection(db, "menuItems"));
        let imageData = {};
        if (imageFile) {
          const result = await uploadImage(itemRef.id);
          if (result) imageData = { imageUrl: result.url, imagePath: result.path };
        }
        await setDoc(itemRef, {
          ...base,
          ...imageData,
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: userProfile?.uid || "",
          createdByName: userProfile?.fullName || "",
        });
        setItems((prev) => [...prev, { id: itemRef.id, ...base, ...imageData, isActive: true }]);
      }
      setShowModal(false);
      setSuccessMsg(editItem ? "Menu item updated." : "Menu item added.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error(err);
      if (err?.code === "storage/unauthorized" || err?.code === "storage/unauthenticated") {
        setError("Could not upload the menu image. Check Storage permissions.");
      } else if (err?.code === "permission-denied") {
        setError("You do not have permission to save menu items.");
      } else {
        setError(err?.message ? `Failed to save menu item: ${err.message}` : "Failed to save menu item.");
      }
    } finally {
      setSaving(false);
      setUploadProgress(null);
    }
  }

  async function handleArchive(item) {
    if (!window.confirm(`Archive "${item.name}"? It will no longer appear on the public menu.`)) return;
    try {
      await updateDoc(doc(db, "menuItems", item.id), { isActive: false, updatedAt: serverTimestamp() });
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setSuccessMsg("Item archived.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      setError("Failed to archive item.");
    }
  }

  const setField = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const filtered = items.filter((item) => {
    return !searchTerm || item.name?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const inputCls = "w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1.5";

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Menu Items</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage the public food ordering menu</p>
          </div>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm"
          >
            <Plus size={16} />
            Add Menu Item
          </button>
        </div>

        {successMsg && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4 text-green-700 text-sm">
            <Check size={15} />
            {successMsg}
          </div>
        )}
        {error && !showModal && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-red-700 text-sm">
            <AlertCircle size={15} />
            {error}
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search menu items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-orange-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <UtensilsCrossed size={36} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No menu items found</p>
            <p className="mt-2 text-sm text-gray-400 max-w-md mx-auto">
              Try adjusting the search, or add the first real menu item.
            </p>
            <button onClick={openAdd} className="mt-5 inline-flex items-center gap-2 text-orange-500 hover:text-orange-600 text-sm font-medium">
              + Add your first item
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Item</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Price</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">Available</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">Popular</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">Special</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                              <UtensilsCrossed size={16} className="text-orange-300" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-900">{item.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-orange-600">GH₵ {Number(item.price).toFixed(2)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${item.isAvailable ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                          {item.isAvailable ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.isPopular ? <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-600">Yes</span> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.isTodaySpecial ? <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">Yes</span> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEdit(item)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                            title="Edit"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => handleArchive(item)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Archive"
                          >
                            <Archive size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
              {filtered.length} item{filtered.length !== 1 ? "s" : ""}
            </div>
          </div>
        )}

        {/* Add / Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto bg-black/40 backdrop-blur-sm">
            <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl my-8">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-900">{editItem ? "Edit Menu Item" : "Add Menu Item"}</h2>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleSave} className="p-5 space-y-4">
                {error && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-red-700 text-sm">
                    <AlertCircle size={15} />
                    {error}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Item Name <span className="text-red-400">*</span></label>
                    <input required className={inputCls} value={form.name} onChange={setField("name")} placeholder="e.g. Jollof Rice with Chicken" />
                  </div>
                  <div>
                    <label className={labelCls}>Price (GH₵) <span className="text-red-400">*</span></label>
                    <input required type="number" min="0" step="0.01" className={inputCls} value={form.price} onChange={setField("price")} placeholder="0.00" />
                  </div>
                  {/* Image upload */}
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Food Image</label>
                    <div className="flex items-start gap-3">
                      {imagePreview ? (
                        <img src={imagePreview} alt="preview" className="w-20 h-20 rounded-xl object-cover border border-gray-200 flex-shrink-0" />
                      ) : (
                        <div className="w-20 h-20 rounded-xl bg-gray-50 border border-dashed border-gray-300 flex items-center justify-center flex-shrink-0">
                          <ImageIcon size={22} className="text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1">
                        <label className="inline-flex items-center gap-2 cursor-pointer bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 text-sm font-medium px-3.5 py-2 rounded-xl transition-colors">
                          <Upload size={14} />
                          {imagePreview ? "Replace Image" : "Upload Image"}
                          <input type="file" accept="image/*" className="sr-only" onChange={handleImageChange} />
                        </label>
                        {uploadProgress !== null && (
                          <div className="mt-2">
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-orange-500 transition-all" style={{ width: `${uploadProgress}%` }} />
                            </div>
                            <p className="text-xs text-gray-400 mt-1">Uploading... {uploadProgress}%</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Toggles */}
                  <div className="sm:col-span-2 flex flex-wrap gap-4">
                    {[
                      { field: "isAvailable", label: "Available" },
                      { field: "isPopular", label: "Mark as Popular" },
                      { field: "isTodaySpecial", label: "Today's Special" },
                    ].map(({ field, label }) => (
                      <label key={field} className="flex items-center gap-2 cursor-pointer">
                        <div className={`w-9 h-5 rounded-full transition-colors ${form[field] ? "bg-orange-500" : "bg-gray-200"} relative`}>
                          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form[field] ? "translate-x-4" : "translate-x-0.5"}`} />
                        </div>
                        <span className="text-sm text-gray-700">{label}</span>
                        <input type="checkbox" className="sr-only" checked={form[field]} onChange={setField(field)} />
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 rounded-xl transition-colors">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold py-2.5 rounded-xl transition-colors"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                    {saving ? "Saving..." : editItem ? "Update Item" : "Add Item"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

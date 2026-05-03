import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, doc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../config/firebase";
import { Plus, Trash2, Settings, Loader2 } from "lucide-react";
import Layout from "../../components/layout/Layout";

export default function SettingsPage() {
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const snap = await getDocs(collection(db, "productCategories"));
        setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Error fetching categories:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCategories();
  }, []);

  async function addCategory() {
    if (!newCategory.trim()) return;
    try {
      await addDoc(collection(db, "productCategories"), {
        name: newCategory.trim(),
        description: "",
        isActive: true,
        createdAt: serverTimestamp(),
      });
      setNewCategory("");
      const snap = await getDocs(collection(db, "productCategories"));
      setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error adding category:", err);
    }
  }

  async function removeCategory(id) {
    if (!confirm("Remove this category?")) return;
    try {
      await deleteDoc(doc(db, "productCategories", id));
      setCategories(categories.filter((c) => c.id !== id));
    } catch (err) {
      console.error("Error removing category:", err);
    }
  }

  const units = ["Unit", "Box", "Pack", "Carton", "Bottle", "Bag", "Piece", "Kg", "Litre", "Gallon", "Roll", "Tablet", "Vial", "Sachet"];

  return (
    <Layout>
      <div className="mb-6 animate-fadeIn">
        <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Settings</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">Configure system settings</p>
      </div>

      <div className="space-y-6 max-w-3xl mx-auto animate-fadeIn">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Product Categories</h2>
            <p className="text-sm text-gray-500 mt-0.5">Manage categories for organizing products</p>
          </div>
          <div className="p-6">
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="New category name"
                className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50/50"
                onKeyDown={(e) => e.key === "Enter" && addCategory()}
              />
              <button
                onClick={addCategory}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <Plus size={16} />
                Add
              </button>
            </div>
            {loading ? (
              <div className="flex items-center gap-2 text-gray-500 py-4">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Loading categories...</span>
              </div>
            ) : (
              <div className="space-y-1">
                {categories.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group">
                    <span className="text-sm text-gray-900">{cat.name}</span>
                    <button
                      onClick={() => removeCategory(cat.id)}
                      className="p-1.5 rounded-md text-gray-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Units of Measure</h2>
            <p className="text-sm text-gray-500 mt-0.5">Available units for product quantities</p>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap gap-2">
              {units.map((u) => (
                <span key={u} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
                  {u}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">System Information</h2>
          </div>
          <div className="p-6">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <dt className="text-sm text-gray-500 mb-1">Organization</dt>
                <dd className="text-sm font-medium text-gray-900">UGMC</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500 mb-1">System</dt>
                <dd className="text-sm font-medium text-gray-900">Inventory Management v1.0</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500 mb-1">Stores</dt>
                <dd className="text-sm font-medium text-gray-900">4 (Stores A, B, C, Kitchen)</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500 mb-1">Backend</dt>
                <dd className="text-sm font-medium text-gray-900">Firebase (Firestore, Auth, Storage)</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </Layout>
  );
}

import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { writeAuditLog } from "../../lib/audit";
import { Plus, Loader2, X } from "lucide-react";
import Layout from "../../components/layout/Layout";
import ConfirmActionModal from "../../components/common/ConfirmActionModal";

export default function SettingsPage() {
  const { currentUser, userProfile } = useAuth();
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedStatusCategory, setSelectedStatusCategory] = useState(null);

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
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog(db, {
        action: "Category created",
        entityType: "productCategory",
        description: `Created category ${newCategory.trim()}`,
        currentUser,
        userProfile,
      });
      setNewCategory("");
      const snap = await getDocs(collection(db, "productCategories"));
      setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error adding category:", err);
    }
  }

  function openEditCategory(category) {
    setSelectedCategory(category);
    setShowEditModal(true);
  }

  function openToggleCategoryModal(category) {
    setSelectedStatusCategory(category);
    setShowStatusModal(true);
  }

  async function toggleCategoryStatus(category) {
    const nextIsActive = category.isActive === false;

    try {
      await updateDoc(doc(db, "productCategories", category.id), {
        isActive: nextIsActive,
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog(db, {
        action: nextIsActive ? "Category reactivated" : "Category archived",
        entityType: "productCategory",
        entityId: category.id,
        description: `${nextIsActive ? "Reactivated" : "Archived"} category ${category.name}`,
        metadata: {
          name: category.name,
          isActive: nextIsActive,
        },
        currentUser,
        userProfile,
      });
      setCategories((prev) =>
        prev.map((entry) =>
          entry.id === category.id
            ? {
                ...entry,
                isActive: nextIsActive,
              }
            : entry
        )
      );
    } catch (err) {
      console.error("Error updating category status:", err);
    }
  }

  const units = ["Unit", "Box", "Pack", "Carton", "Bottle", "Bag", "Piece", "Kg", "Litre", "Gallon", "Roll", "Tablet", "Vial", "Sachet"];

  return (
    <Layout>
      <div className="mb-6 animate-fadeIn">
        <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Settings</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">Manage product categories and units of measure</p>
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
                className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
                onKeyDown={(e) => e.key === "Enter" && addCategory()}
              />
              <button
                onClick={addCategory}
                className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
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
                {categories.map((cat) => {
                  const isActive = cat.isActive !== false;
                  return (
                    <div key={cat.id} className={`flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group ${!isActive ? "opacity-70" : ""}`}>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-900 font-medium">{cat.name}</span>
                          <span className={`inline-flex px-2 py-0.5 text-[11px] font-medium rounded-full ${isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                            {isActive ? "Active" : "Archived"}
                          </span>
                        </div>
                        {cat.description && <p className="text-xs text-gray-500 mt-0.5">{cat.description}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditCategory(cat)}
                          className="px-3 py-1.5 rounded-md text-xs font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openToggleCategoryModal(cat)}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors opacity-0 group-hover:opacity-100 ${
                            isActive
                              ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                              : "border-green-200 text-green-700 hover:bg-green-50"
                          }`}
                        >
                          {isActive ? "Archive" : "Activate"}
                        </button>
                      </div>
                    </div>
                  );
                })}
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

      </div>
      {showEditModal && selectedCategory && (
        <EditCategoryModal
          category={selectedCategory}
          onClose={() => {
            setShowEditModal(false);
            setSelectedCategory(null);
          }}
          onSaved={(updatedCategory) => {
            setCategories((prev) => prev.map((entry) => (entry.id === updatedCategory.id ? updatedCategory : entry)));
            setShowEditModal(false);
            setSelectedCategory(null);
          }}
        />
      )}
      {showStatusModal && selectedStatusCategory && (
        <ConfirmActionModal
          open={showStatusModal}
          title={`${selectedStatusCategory.isActive === false ? "Activate" : "Archive"} category`}
          description={`${selectedStatusCategory.isActive === false ? "Reactivate" : "Archive"} "${selectedStatusCategory.name}"? Archived categories remain available for records and can be reactivated later.`}
          confirmLabel={selectedStatusCategory.isActive === false ? "Activate" : "Archive"}
          tone={selectedStatusCategory.isActive === false ? "success" : "warning"}
          onCancel={() => {
            setShowStatusModal(false);
            setSelectedStatusCategory(null);
          }}
          onConfirm={async () => {
            if (!selectedStatusCategory) return;
            await toggleCategoryStatus(selectedStatusCategory);
            setShowStatusModal(false);
            setSelectedStatusCategory(null);
          }}
        />
      )}
    </Layout>
  );
}

function EditCategoryModal({ category, onClose, onSaved }) {
  const { currentUser, userProfile } = useAuth();
  const [formData, setFormData] = useState({
    name: category.name || "",
    description: category.description || "",
    isActive: category.isActive !== false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const updates = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        isActive: formData.isActive,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, "productCategories", category.id), updates);
      await writeAuditLog(db, {
        action: "Category updated",
        entityType: "productCategory",
        entityId: category.id,
        description: `Updated category ${category.name}`,
        metadata: updates,
        currentUser,
        userProfile,
      });

      onSaved({
        ...category,
        ...updates,
      });
    } catch (err) {
      setError("Failed to update category.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Edit Category</h2>
            <p className="text-sm text-gray-500 mt-0.5">Update category details</p>
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Category Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50 resize-none"
              placeholder="Optional description"
            />
          </div>

          <label className="flex items-center justify-between gap-4 p-3 rounded-lg border border-gray-200 bg-gray-50/50">
            <div>
              <p className="text-sm font-medium text-gray-900">Active status</p>
              <p className="text-xs text-gray-500">Inactive categories remain for historical records.</p>
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
              className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
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

import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../config/firebase";
import { Plus, X, Truck, Loader2, Search } from "lucide-react";
import Layout from "../../components/layout/Layout";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function fetchSuppliers() {
      try {
        const snap = await getDocs(collection(db, "suppliers"));
        setSuppliers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Error fetching suppliers:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchSuppliers();
  }, []);

  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.contactPerson && s.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6 animate-fadeIn">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Suppliers</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Manage supplier information</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus size={15} />
          Add Supplier
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 mb-6 animate-fadeIn">
        <div className="p-4">
          <div className="relative max-w-sm">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search suppliers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-fadeIn">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 size={24} className="text-gray-400 animate-spin mx-auto mb-3" />
            <p className="text-gray-500">Loading suppliers...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Truck size={24} className="text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">
              {suppliers.length === 0 ? "No suppliers added yet" : "No suppliers match your search"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Name</th>
                  <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Contact Person</th>
                  <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Phone</th>
                  <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Email</th>
                  <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{supplier.name}</td>
                    <td className="px-6 py-4 text-gray-500">{supplier.contactPerson || "—"}</td>
                    <td className="px-6 py-4 text-gray-500">{supplier.phone || "—"}</td>
                    <td className="px-6 py-4 text-gray-500">{supplier.email || "—"}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                        supplier.isActive !== false ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                      }`}>
                        {supplier.isActive !== false ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && <AddSupplierModal onClose={() => setShowAddModal(false)} />}
    </Layout>
  );
}

function AddSupplierModal({ onClose }) {
  const [formData, setFormData] = useState({
    name: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, "suppliers"), {
        ...formData,
        productCategories: [],
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      onClose();
      window.location.reload();
    } catch (err) {
      console.error("Error adding supplier:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Add Supplier</h2>
            <p className="text-sm text-gray-500 mt-0.5">Add a new supplier to the system</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Supplier Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Contact Person</label>
              <input
                type="text"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Address</label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={2}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50 resize-none"
            />
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
              className="flex-1 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 size={14} className="animate-spin" />Adding...</> : "Add Supplier"}
            </button>
          </div>
        </form>
      </div>
    </div>
    </Layout>
  );
}

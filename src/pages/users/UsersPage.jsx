import { useState, useEffect } from "react";
import { collection, getDocs, setDoc, serverTimestamp, doc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../../config/firebase";
import { Plus, X, Users, Loader2, Search } from "lucide-react";
import Layout from "../../components/layout/Layout";

const ROLES = ["SUPER_ADMIN", "ADMIN", "STORE_MANAGER", "STORE_OFFICER", "SUPERVISOR", "AUDITOR", "NURSE", "KITCHEN_STAFF"];

const MEAL_ROLES = new Set(["NURSE", "KITCHEN_STAFF"]);

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [stores, setStores] = useState([]);
  const [wards, setWards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function fetchData() {
      const [usersSnap, storesSnap, wardsSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "stores")),
        getDocs(collection(db, "wards")),
      ]);
      setUsers(usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setStores(storesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setWards(wardsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }
    fetchData();
  }, []);

  const filtered = users.filter((u) =>
    u.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const roleColors = {
    SUPER_ADMIN: "bg-red-100 text-red-700",
    ADMIN: "bg-orange-100 text-orange-700",
    STORE_MANAGER: "bg-primary-100 text-primary-700",
    STORE_OFFICER: "bg-green-100 text-green-700",
    SUPERVISOR: "bg-violet-100 text-violet-700",
    AUDITOR: "bg-gray-100 text-gray-700",
    NURSE: "bg-blue-100 text-blue-700",
    KITCHEN_STAFF: "bg-amber-100 text-amber-700",
  };

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6 animate-fadeIn">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Users</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Manage system users and roles</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus size={15} />
          Add User
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 mb-6 animate-fadeIn">
        <div className="p-4">
          <div className="relative max-w-sm">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
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
            <p className="text-gray-500">Loading users...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Users size={24} className="text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">
              {users.length === 0 ? "No users found" : "No users match your search"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Name</th>
                  <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Email</th>
                  <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Role</th>
                  <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Stores</th>
                  <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-medium text-white">
                            {user.fullName?.charAt(0) || "U"}
                          </span>
                        </div>
                        <span className="font-medium text-gray-900">{user.fullName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{user.email}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${roleColors[user.role] || "bg-gray-100 text-gray-700"}`}>
                        {user.role?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {user.assignedStores?.length > 0
                        ? user.assignedStores.map((sid) => stores.find((s) => s.id === sid)?.name).filter(Boolean).join(", ")
                        : "All"}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                        user.isActive !== false ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                      }`}>
                        {user.isActive !== false ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && <AddUserModal stores={stores} wards={wards} onClose={() => setShowAddModal(false)} />}
    </Layout>
  );
}

function AddUserModal({ stores, wards, onClose }) {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
    role: "STORE_OFFICER",
    assignedStores: [],
    assignedWards: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      await setDoc(doc(db, "users", userCredential.user.uid), {
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        role: formData.role,
        assignedStores: MEAL_ROLES.has(formData.role) ? [] : formData.assignedStores,
        assignedWards: formData.role === "NURSE" ? formData.assignedWards : [],
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      onClose();
      window.location.reload();
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setError("Email already in use.");
      } else {
        setError("Failed to create user.");
      }
    } finally {
      setLoading(false);
    }
  }

  function toggleStore(storeId) {
    const current = formData.assignedStores;
    if (current.includes(storeId)) {
      setFormData({ ...formData, assignedStores: current.filter((id) => id !== storeId) });
    } else {
      setFormData({ ...formData, assignedStores: [...current, storeId] });
    }
  }

  return (
    <Layout>
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Add User</h2>
            <p className="text-sm text-gray-500 mt-0.5">Create a new user account</p>
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email <span className="text-red-500">*</span></label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Password <span className="text-red-500">*</span></label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
              required
              minLength={6}
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Role <span className="text-red-500">*</span></label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
              required
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {formData.role === "NURSE" ? "Assigned Wards" : "Assigned Stores"}
            </label>
            {formData.role === "NURSE" ? (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {wards.filter(w => w.isActive !== false).map((ward) => (
                  <label key={ward.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.assignedWards.includes(ward.id)}
                      onChange={() => toggleWard(ward.id)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">{ward.name}</span>
                  </label>
                ))}
                {wards.filter(w => w.isActive !== false).length === 0 && (
                  <p className="text-xs text-gray-400 px-2">No wards configured yet.</p>
                )}
              </div>
            ) : MEAL_ROLES.has(formData.role) ? (
              <p className="text-xs text-gray-400">Kitchen staff have access to all wards.</p>
            ) : (
              <div className="space-y-2">
                {stores.map((store) => (
                  <label key={store.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.assignedStores.includes(store.id)}
                      onChange={() => toggleStore(store.id)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">{store.name}</span>
                  </label>
                ))}
              </div>
            )}
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
              {loading ? <><Loader2 size={14} className="animate-spin" />Creating...</> : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
    </Layout>
  );
}


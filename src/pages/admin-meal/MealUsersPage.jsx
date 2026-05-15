import { useState, useEffect } from "react";
import { collection, getDocs, setDoc, updateDoc, serverTimestamp, doc } from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { db, firebaseConfig } from "../../config/firebase";
import { Plus, X, Users, Loader2, Search, UserCheck, ChefHat } from "lucide-react";
import { KITCHEN_ACCESS_KEYS, KITCHEN_ACCESS_OPTIONS } from "../../lib/permissions";

const MEAL_ROLES = ["NURSE", "KITCHEN_STAFF"];

const ROLE_META = {
  NURSE: {
    label: "Nurse",
    color: "bg-blue-100 text-blue-700",
    icon: UserCheck,
    description: "Can place meal orders for their assigned wards",
  },
  KITCHEN_STAFF: {
    label: "Kitchen Staff",
    color: "bg-amber-100 text-amber-700",
    icon: ChefHat,
    description: "Manages food preparation and fulfillment",
  },
};

const KITCHEN_MAIN_ACCESS = KITCHEN_ACCESS_OPTIONS.filter((option) => !option.adminOnly);
const KITCHEN_ADMIN_ACCESS = KITCHEN_ACCESS_OPTIONS.filter((option) => option.adminOnly);

function getKitchenAccessSummary(access) {
  if (!access) return [];
  if (access.admin) return ["Full access"];
  const items = Array.isArray(access.sections) ? access.sections : [];
  return items
    .map((key) => KITCHEN_ACCESS_OPTIONS.find((option) => option.key === key)?.label || key)
    .filter(Boolean);
}

export default function MealUsersPage() {
  const [users, setUsers] = useState([]);
  const [wards, setWards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  async function fetchData() {
    const [usersSnap, wardsSnap] = await Promise.all([
      getDocs(collection(db, "users")),
      getDocs(collection(db, "wards")),
    ]);
    const allUsers = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setUsers(allUsers.filter((u) => MEAL_ROLES.includes(u.role)));
    setWards(wardsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  const filtered = users.filter(
    (u) =>
      u.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  async function handleToggleActive(user) {
    const next = user.isActive === false ? true : false;
    await updateDoc(doc(db, "users", user.id), { isActive: next, updatedAt: serverTimestamp() });
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isActive: next } : u)));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Meal Ordering Staff</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Manage nurses and kitchen staff accounts</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus size={15} />
          Add Staff
        </button>
      </div>

      {/* Role summary cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {MEAL_ROLES.map((role) => {
          const count = users.filter((u) => u.role === role).length;
          const meta = ROLE_META[role];
          const Icon = meta.icon;
          const countLabel = role === "KITCHEN_STAFF"
            ? "Kitchen Staff"
            : count === 1
              ? meta.label
              : `${meta.label}s`;
          return (
            <div key={role} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${meta.color}`}>
                <Icon size={18} />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{count}</p>
                <p className="text-xs text-gray-500">{countLabel}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 mb-4">
        <div className="p-4">
          <div className="relative max-w-sm">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search staff..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 size={24} className="text-gray-400 animate-spin mx-auto mb-3" />
            <p className="text-gray-500">Loading staff…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Users size={24} className="text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">
              {users.length === 0 ? "No meal staff yet" : "No staff match your search"}
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
                  <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Scope</th>
                  <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((user) => {
                  const meta = ROLE_META[user.role] || { label: user.role, color: "bg-gray-100 text-gray-700" };
                  const wardNames = user.assignedWards?.length
                    ? user.assignedWards
                        .map((wid) => wards.find((w) => w.id === wid)?.name || wid)
                        .join(", ")
                    : null;
                  const kitchenAccessLabels = getKitchenAccessSummary(user.kitchenAccess);
                  return (
                    <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-medium text-white">
                              {user.fullName?.charAt(0) || "?"}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{user.fullName}</p>
                            {user.phone && <p className="text-xs text-gray-400">{user.phone}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-500">{user.email}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${meta.color}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 text-sm max-w-[300px]">
                        {user.role === "NURSE" ? (
                          wardNames ? (
                            <div className="truncate">{wardNames}</div>
                          ) : (
                            <span className="text-gray-400 italic">No wards assigned</span>
                          )
                        ) : user.kitchenAccess?.admin ? (
                          <span className="inline-flex items-center rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">
                            Full access
                          </span>
                        ) : kitchenAccessLabels.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {kitchenAccessLabels.slice(0, 4).map((label) => (
                              <span key={label} className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700">
                                {label}
                              </span>
                            ))}
                            {kitchenAccessLabels.length > 4 && (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500">
                                +{kitchenAccessLabels.length - 4}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">No portal access</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                          user.isActive !== false ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}>
                          {user.isActive !== false ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleToggleActive(user)}
                          className="text-xs text-gray-400 hover:text-gray-700 underline transition-colors"
                        >
                          {user.isActive !== false ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && (
        <AddStaffModal
          wards={wards}
          onClose={() => setShowAddModal(false)}
          onCreated={() => { setShowAddModal(false); fetchData(); }}
        />
      )}
    </div>
  );
}

function AddStaffModal({ wards, onClose, onCreated }) {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
    role: "NURSE",
    assignedWards: [],
    kitchenAccess: {
      admin: false,
      sections: ["dashboard", "patients", "menus", "reports"],
    },
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggleWard(wid) {
    setForm((f) => ({
      ...f,
      assignedWards: f.assignedWards.includes(wid)
        ? f.assignedWards.filter((id) => id !== wid)
        : [...f.assignedWards, wid],
    }));
  }

  function toggleKitchenSection(key) {
    setForm((f) => ({
      ...f,
      kitchenAccess: {
        ...f.kitchenAccess,
        sections: f.kitchenAccess.sections.includes(key)
          ? f.kitchenAccess.sections.filter((section) => section !== key)
          : [...f.kitchenAccess.sections, key],
      },
    }));
  }

  function toggleKitchenAdmin(next) {
    setForm((f) => ({
      ...f,
      kitchenAccess: {
        ...f.kitchenAccess,
        admin: next,
        sections: next ? [...KITCHEN_ACCESS_KEYS] : f.kitchenAccess.sections,
      },
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    // Use a secondary Firebase app so creating the new account does not
    // replace the admin's current auth session.
    const tempApp = initializeApp(firebaseConfig, `create-staff-${Date.now()}`);
    const tempAuth = getAuth(tempApp);
    try {
      if (form.role === "KITCHEN_STAFF" && !form.kitchenAccess.admin && form.kitchenAccess.sections.length === 0) {
        setError("Choose at least one kitchen access area or enable Admin access.");
        setLoading(false);
        await deleteApp(tempApp).catch(() => {});
        return;
      }
      const cred = await createUserWithEmailAndPassword(tempAuth, form.email, form.password);
      await setDoc(doc(db, "users", cred.user.uid), {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        role: form.role,
        assignedWards: form.role === "NURSE" ? form.assignedWards : [],
        kitchenAccess: form.role === "KITCHEN_STAFF"
          ? {
              admin: form.kitchenAccess.admin,
              sections: form.kitchenAccess.admin ? [...KITCHEN_ACCESS_KEYS] : form.kitchenAccess.sections,
            }
          : null,
        assignedStores: [],
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      onCreated();
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setError("That email is already in use.");
      } else {
        setError("Failed to create account. Try again.");
        console.error(err);
      }
    } finally {
      await deleteApp(tempApp).catch(() => {});
      setLoading(false);
    }
  }

  const activeWards = wards.filter((w) => w.isActive !== false);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Add Meal Staff</h2>
            <p className="text-sm text-gray-500 mt-0.5">Create a nurse or kitchen staff account</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Role selector — shown first so ward list updates */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Role <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-3">
              {MEAL_ROLES.map((role) => {
                const meta = ROLE_META[role];
                const Icon = meta.icon;
                const selected = form.role === role;
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setForm((f) => ({
                      ...f,
                      role,
                      assignedWards: role === "NURSE" ? [] : f.assignedWards,
                      kitchenAccess: role === "KITCHEN_STAFF"
                        ? {
                            admin: false,
                            sections: ["dashboard", "patients", "menus", "reports"],
                          }
                        : f.kitchenAccess,
                    }))}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                      selected
                        ? "border-primary-500 bg-primary-50"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <Icon size={18} className={selected ? "text-primary-600" : "text-gray-400"} />
                    <div>
                      <p className={`text-sm font-semibold ${selected ? "text-primary-700" : "text-gray-700"}`}>
                        {meta.label}
                      </p>
                      <p className="text-[11px] text-gray-400 leading-tight">{meta.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email <span className="text-red-500">*</span></label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Password <span className="text-red-500">*</span></label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
              required
              minLength={6}
            />
          </div>

          {form.role === "NURSE" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assigned Wards
                <span className="ml-1.5 text-xs text-gray-400 font-normal">(select all that apply)</span>
              </label>
              {activeWards.length === 0 ? (
                <p className="text-xs text-gray-400">No wards configured yet. Add wards first.</p>
              ) : (
                <div className="space-y-1.5 max-h-44 overflow-y-auto rounded-lg border border-gray-200 p-3 bg-gray-50/50">
                  {activeWards.map((ward) => (
                    <label key={ward.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={form.assignedWards.includes(ward.id)}
                        onChange={() => toggleWard(ward.id)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <div>
                        <span className="text-sm text-gray-700 font-medium">{ward.name}</span>
                        {ward.type && (
                          <span className="ml-2 text-xs text-gray-400">{ward.type}</span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {form.role === "KITCHEN_STAFF" && (
            <div className="space-y-3 rounded-xl border border-amber-100 bg-amber-50/60 p-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Kitchen Portal Access</label>
                <p className="text-xs text-gray-500">
                  Choose the pages this account should see in the kitchen sidebar. Admin access grants everything.
                </p>
              </div>

              <label className="flex items-start gap-3 rounded-lg border border-amber-100 bg-white px-3 py-3">
                <input
                  type="checkbox"
                  checked={form.kitchenAccess.admin}
                  onChange={(e) => toggleKitchenAdmin(e.target.checked)}
                  className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">Admin access</p>
                  <p className="text-xs text-gray-500">Full access to the entire kitchen portal, including administration pages.</p>
                </div>
              </label>

              <div className={`space-y-4 ${form.kitchenAccess.admin ? "opacity-60" : ""}`}>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">Main Sidebar</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {KITCHEN_MAIN_ACCESS.map((option) => {
                      const checked = form.kitchenAccess.sections.includes(option.key);
                      return (
                        <label key={option.key} className={`flex items-start gap-3 rounded-lg border px-3 py-3 transition-colors ${checked ? "border-primary-200 bg-primary-50" : "border-gray-200 bg-white hover:border-gray-300"}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={form.kitchenAccess.admin}
                            onChange={() => toggleKitchenSection(option.key)}
                            className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:cursor-not-allowed"
                          />
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{option.label}</p>
                            <p className="text-[11px] leading-tight text-gray-500">{option.description}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">Administration</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {KITCHEN_ADMIN_ACCESS.map((option) => {
                      const checked = form.kitchenAccess.sections.includes(option.key);
                      return (
                        <label key={option.key} className={`flex items-start gap-3 rounded-lg border px-3 py-3 transition-colors ${checked ? "border-primary-200 bg-primary-50" : "border-gray-200 bg-white hover:border-gray-300"}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={form.kitchenAccess.admin}
                            onChange={() => toggleKitchenSection(option.key)}
                            className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:cursor-not-allowed"
                          />
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{option.label}</p>
                            <p className="text-[11px] leading-tight text-gray-500">{option.description}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

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
              {loading ? <><Loader2 size={14} className="animate-spin" /> Creating…</> : "Create Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { writeAuditLog } from "../../lib/audit";
import { Plus, X, Users, Loader2, Search, PencilLine, ToggleLeft, ToggleRight } from "lucide-react";
import Layout from "../../components/layout/Layout";
import ConfirmActionModal from "../../components/common/ConfirmActionModal";

const RECIPIENT_TYPES = ["DEPARTMENT", "WARD", "UNIT", "STAFF", "STORE", "OTHER"];

export default function RecipientsPage() {
  const { currentUser, userProfile } = useAuth();
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedStatusRecipient, setSelectedStatusRecipient] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function fetchRecipients() {
      try {
        const snap = await getDocs(collection(db, "recipients"));
        setRecipients(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Error fetching recipients:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchRecipients();
  }, []);

  const filtered = recipients.filter((r) =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const typeColors = {
    DEPARTMENT: "bg-primary-100 text-primary-700",
    WARD: "bg-violet-100 text-violet-700",
    UNIT: "bg-emerald-100 text-emerald-700",
    STAFF: "bg-amber-100 text-amber-700",
    STORE: "bg-cyan-100 text-cyan-700",
    OTHER: "bg-gray-100 text-gray-700",
  };

  function openEditModal(recipient) {
    setSelectedRecipient(recipient);
    setShowEditModal(true);
  }

  function openToggleRecipientStatusModal(recipient) {
    setSelectedStatusRecipient(recipient);
    setShowStatusModal(true);
  }

  async function toggleRecipientStatus(recipient) {
    const nextIsActive = recipient.isActive === false;

    try {
      await updateDoc(doc(db, "recipients", recipient.id), {
        isActive: nextIsActive,
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog(db, {
        action: nextIsActive ? "Recipient reactivated" : "Recipient deactivated",
        entityType: "recipient",
        entityId: recipient.id,
        description: `${nextIsActive ? "Reactivated" : "Deactivated"} recipient ${recipient.name}`,
        metadata: {
          name: recipient.name,
          isActive: nextIsActive,
        },
        currentUser,
        userProfile,
      });
      setRecipients((prev) =>
        prev.map((entry) =>
          entry.id === recipient.id
            ? {
                ...entry,
                isActive: nextIsActive,
              }
            : entry
        )
      );
    } catch (err) {
      console.error("Error updating recipient status:", err);
    }
  }

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6 animate-fadeIn">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Recipients</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Manage departments, wards, and recipients</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus size={15} />
          Add Recipient
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 mb-6 animate-fadeIn">
        <div className="p-4">
          <div className="relative max-w-sm">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search recipients..."
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
            <p className="text-gray-500">Loading recipients...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Users size={24} className="text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">
              {recipients.length === 0 ? "No recipients added yet" : "No recipients match your search"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Name</th>
                  <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Type</th>
                  <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Phone</th>
                  <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Email</th>
                  <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Status</th>
                  <th className="text-right px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((recipient) => (
                  <tr key={recipient.id} className={`hover:bg-gray-50/50 transition-colors ${recipient.isActive === false ? "opacity-70" : ""}`}>
                    <td className="px-6 py-4 font-medium text-gray-900">{recipient.name}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${typeColors[recipient.type] || "bg-gray-100 text-gray-700"}`}>
                        {recipient.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{recipient.phone || "—"}</td>
                    <td className="px-6 py-4 text-gray-500">{recipient.email || "—"}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                        recipient.isActive !== false ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                      }`}>
                        {recipient.isActive !== false ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(recipient)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-medium transition-colors"
                        >
                          <PencilLine size={13} />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => openToggleRecipientStatusModal(recipient)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            recipient.isActive !== false
                              ? "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                              : "border border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                          }`}
                        >
                          {recipient.isActive !== false ? <ToggleLeft size={13} /> : <ToggleRight size={13} />}
                          {recipient.isActive !== false ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && <AddRecipientModal onClose={() => setShowAddModal(false)} />}
      {showEditModal && selectedRecipient && (
        <EditRecipientModal
          recipient={selectedRecipient}
          onClose={() => {
            setShowEditModal(false);
            setSelectedRecipient(null);
          }}
          onSaved={(updatedRecipient) => {
            setRecipients((prev) => prev.map((entry) => (entry.id === updatedRecipient.id ? updatedRecipient : entry)));
            setShowEditModal(false);
            setSelectedRecipient(null);
          }}
        />
      )}
      {showStatusModal && selectedStatusRecipient && (
        <ConfirmActionModal
          open={showStatusModal}
          title={`${selectedStatusRecipient.isActive === false ? "Activate" : "Deactivate"} recipient`}
          description={`${selectedStatusRecipient.isActive === false ? "Reactivate" : "Deactivate"} "${selectedStatusRecipient.name}"?`}
          confirmLabel={selectedStatusRecipient.isActive === false ? "Activate" : "Deactivate"}
          tone={selectedStatusRecipient.isActive === false ? "success" : "warning"}
          onCancel={() => {
            setShowStatusModal(false);
            setSelectedStatusRecipient(null);
          }}
          onConfirm={async () => {
            if (!selectedStatusRecipient) return;
            await toggleRecipientStatus(selectedStatusRecipient);
            setShowStatusModal(false);
            setSelectedStatusRecipient(null);
          }}
        />
      )}
    </Layout>
  );
}

function EditRecipientModal({ recipient, onClose, onSaved }) {
  const { currentUser, userProfile } = useAuth();
  const [formData, setFormData] = useState({
    name: recipient.name || "",
    type: recipient.type || "DEPARTMENT",
    phone: recipient.phone || "",
    email: recipient.email || "",
    notes: recipient.notes || "",
    isActive: recipient.isActive !== false,
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
        type: formData.type,
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        notes: formData.notes.trim(),
        isActive: formData.isActive,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, "recipients", recipient.id), updates);
      await writeAuditLog(db, {
        action: "Recipient updated",
        entityType: "recipient",
        entityId: recipient.id,
        description: `Updated recipient ${recipient.name}`,
        metadata: updates,
        currentUser,
        userProfile,
      });

      onSaved({
        ...recipient,
        ...updates,
      });
    } catch (err) {
      setError("Failed to update recipient.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
        <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Edit Recipient</h2>
              <p className="text-sm text-gray-500 mt-0.5">Update recipient details</p>
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
                >
                  {RECIPIENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                <select
                  value={formData.isActive ? "active" : "inactive"}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.value === "active" })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50 resize-none"
              />
            </div>
            <div className="flex gap-3 pt-4 border-t border-gray-100">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {loading ? <><Loader2 size={14} className="animate-spin" />Saving...</> : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
  );
}

function AddRecipientModal({ onClose }) {
  const { currentUser, userProfile } = useAuth();
  const [formData, setFormData] = useState({
    name: "",
    type: "DEPARTMENT",
    phone: "",
    email: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, "recipients"), {
        ...formData,
        department: "",
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog(db, {
        action: "Recipient created",
        entityType: "recipient",
        description: `Created recipient ${formData.name}`,
        metadata: {
          type: formData.type,
          phone: formData.phone,
          email: formData.email,
        },
        currentUser,
        userProfile,
      });
      onClose();
      window.location.reload();
    } catch (err) {
      console.error("Error adding recipient:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Add Recipient</h2>
            <p className="text-sm text-gray-500 mt-0.5">Add a new recipient or department</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
              placeholder="e.g. Emergency Ward"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Type <span className="text-red-500">*</span></label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
              required
            >
              {RECIPIENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
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
              {loading ? <><Loader2 size={14} className="animate-spin" />Adding...</> : "Add Recipient"}
            </button>
          </div>
        </form>
      </div>
    </div>
    </Layout>
  );
}

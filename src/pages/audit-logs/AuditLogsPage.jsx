import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "../../config/firebase";
import { ShieldCheck, Loader2 } from "lucide-react";
import Layout from "../../components/layout/Layout";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLogs() {
      try {
        const q = query(collection(db, "auditLogs"), orderBy("createdAt", "desc"), limit(200));
        const snap = await getDocs(q);
        setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Error fetching audit logs:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, []);

  const actionColors = {
    "User logged in": "bg-primary-100 text-primary-700",
    "Product added": "bg-green-100 text-green-700",
    "Stock received": "bg-emerald-100 text-emerald-700",
    "Stock issued": "bg-primary-100 text-primary-700",
    "Stock adjusted": "bg-amber-100 text-amber-700",
    "User created": "bg-violet-100 text-violet-700",
  };

  return (
    <Layout>
      <div className="mb-6 animate-fadeIn">
        <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Audit Logs</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">Track all system activities</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-fadeIn">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 size={24} className="text-gray-400 animate-spin mx-auto mb-3" />
            <p className="text-gray-500">Loading audit logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck size={24} className="text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">No audit logs recorded yet</p>
            <p className="text-sm text-gray-400 mt-1">Activities will be logged here</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {logs.map((log) => (
              <div key={log.id} className="px-6 py-4 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${log.action?.includes("received") ? "bg-green-500" : log.action?.includes("issued") ? "bg-primary-500" : "bg-gray-400"}`}></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{log.action}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {log.userName} ({log.userRole})
                        {log.storeName && <span> · {log.storeName}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-400">
                      {log.createdAt?.toDate?.()?.toLocaleString() || "N/A"}
                    </span>
                  </div>
                </div>
                {log.description && (
                  <p className="text-xs text-gray-600 mt-2 ml-5">{log.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}


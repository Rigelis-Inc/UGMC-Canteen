import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { ClipboardList, Users, Clock, CheckCircle, AlertTriangle, Plus } from "lucide-react";
import { format } from "date-fns";

const MEAL_PERIOD_COLORS = {
  BREAKFAST: "bg-amber-100 text-amber-700",
  LUNCH: "bg-blue-100 text-blue-700",
  SUPPER: "bg-purple-100 text-purple-700",
};

const STATUS_COLORS = {
  REQUESTED: "bg-orange-100 text-orange-700",
  APPROVED: "bg-blue-100 text-blue-700",
  PREPARING: "bg-yellow-100 text-yellow-700",
  SERVED: "bg-green-100 text-green-700",
  DELIVERED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export default function NurseDashboardPage() {
  const { userProfile, assignedWards } = useAuth();
  const [todayOrders, setTodayOrders] = useState([]);
  const [patientCount, setPatientCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const today = format(new Date(), "yyyy-MM-dd");
  const dayName = format(new Date(), "EEEE, MMMM d, yyyy");

  useEffect(() => {
    async function load() {
      if (!userProfile) return;
      try {
        const wardIds = assignedWards;

        // Count active patients
        if (wardIds.length > 0) {
          const pSnap = await getDocs(
            query(collection(db, "patients"),
              where("wardId", "in", wardIds),
              where("status", "==", "ADMITTED"))
          );
          setPatientCount(pSnap.size);
        }

        // Today's orders
        const oSnap = await getDocs(
          query(
            collection(db, "wardMealOrders"),
            where("orderDate", "==", today),
            where("requestedBy", "==", userProfile.uid || ""),
            orderBy("requestedAt", "desc"),
            limit(20)
          )
        );
        setTodayOrders(oSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [userProfile, assignedWards, today]);

  const summary = {
    requested: todayOrders.filter(o => o.status === "REQUESTED").length,
    served: todayOrders.filter(o => o.status === "SERVED").length,
    late: todayOrders.filter(o => o.isLate).length,
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Ward Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">{dayName}</p>
        </div>
        <Link
          to="/nurse/orders"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm"
        >
          <Plus size={15} />
          Place Meal Orders
        </Link>
      </div>

      {/* Ward info */}
      {assignedWards.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Your Ward(s)</p>
          <div className="flex flex-wrap gap-2">
            {assignedWards.map(w => (
              <span key={w} className="px-3 py-1 bg-primary-50 text-primary-700 border border-primary-200 rounded-full text-sm font-medium">
                {w}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Admitted Patients" value={patientCount} color="blue" loading={loading} />
        <StatCard icon={ClipboardList} label="Orders Today" value={todayOrders.length} color="orange" loading={loading} />
        <StatCard icon={Clock} label="Pending" value={summary.requested} color="yellow" loading={loading} />
        <StatCard icon={CheckCircle} label="Served" value={summary.served} color="green" loading={loading} />
      </div>

      {/* Late orders warning */}
      {summary.late > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">{summary.late} late order{summary.late > 1 ? "s" : ""} today</p>
            <p className="text-xs text-amber-700 mt-0.5">These were submitted after the meal cutoff time.</p>
          </div>
        </div>
      )}

      {/* Today's orders */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Today's Orders</h2>
          <Link to="/nurse/history" className="text-sm text-primary-600 hover:underline">View all history</Link>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading orders...</div>
        ) : todayOrders.length === 0 ? (
          <div className="p-8 text-center">
            <ClipboardList size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-slate-500 text-sm">No orders placed today.</p>
            <Link to="/nurse/orders" className="mt-3 inline-block text-sm text-primary-600 hover:underline">
              Place meal orders →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {todayOrders.map(order => (
              <div key={order.id} className="flex items-center gap-4 px-5 py-3 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 truncate">{order.patientName}</p>
                  <p className="text-slate-500 text-xs">Bed {order.bedNumber} · {order.wardName}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${MEAL_PERIOD_COLORS[order.mealPeriod] || "bg-slate-100 text-slate-600"}`}>
                    {order.mealPeriod}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[order.status] || "bg-slate-100 text-slate-600"}`}>
                    {order.status}
                  </span>
                  {order.isLate && (
                    <AlertTriangle size={13} className="text-amber-500" title="Late order" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, loading }) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    orange: "bg-orange-50 text-orange-600",
    yellow: "bg-yellow-50 text-yellow-600",
    green: "bg-green-50 text-green-600",
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${colors[color]}`}>
        <Icon size={18} />
      </div>
      <p className="text-2xl font-bold text-slate-900">{loading ? "—" : value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

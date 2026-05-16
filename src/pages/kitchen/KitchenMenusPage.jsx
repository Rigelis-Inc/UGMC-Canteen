import { useEffect, useState, useCallback } from "react";
import { collection, query, getDocs, orderBy } from "firebase/firestore";
import { db } from "../../config/firebase";
import { BookOpen, Clock, ChefHat } from "lucide-react";

const DAYS = ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"];
const DAY_SHORT = { MONDAY:"Mon", TUESDAY:"Tue", WEDNESDAY:"Wed", THURSDAY:"Thu", FRIDAY:"Fri", SATURDAY:"Sat", SUNDAY:"Sun" };
const PERIODS = ["BREAKFAST","LUNCH","SUPPER"];
const PERIOD_LABEL = { BREAKFAST:"Breakfast", LUNCH:"Lunch", SUPPER:"Supper" };
const PERIOD_TIME  = { BREAKFAST:"6:00 am", LUNCH:"12:00 pm", SUPPER:"5:00 pm" };

export default function KitchenMenusPage() {
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState("MONDAY");

  const load = useCallback(async () => {
    try {
      const snap = await getDocs(query(collection(db, "mealMenus"), orderBy("dayOfWeek"), orderBy("mealPeriod")));
      setMenus(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const dayMenus = PERIODS.map(p => menus.find(m => m.dayOfWeek === day && m.mealPeriod === p) || null);

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Meal Menus</h1>
        <p className="text-sm text-slate-500">Weekly standard menu — read only. Contact admin to make changes.</p>
      </div>

      {/* Day tabs */}
      <div className="flex flex-wrap gap-1.5">
        {DAYS.map(d => (
          <button key={d} onClick={() => setDay(d)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              day === d ? "bg-primary-600 text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}>
            {DAY_SHORT[d]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-slate-400 text-sm py-12">Loading menus…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {PERIODS.map((period, idx) => {
            const menu = dayMenus[idx];
            const mains  = menu?.items?.filter(i => i.category === "MAIN")  || [];
            const sides  = menu?.items?.filter(i => i.category === "SIDE")  || [];
            const drinks = menu?.items?.filter(i => i.category === "DRINK") || [];
            return (
              <div key={period} className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
                  <ChefHat size={14} className="text-primary-600" />
                  <span className="font-semibold text-slate-800 text-sm">{PERIOD_LABEL[period]}</span>
                  <span className="text-xs text-slate-400 flex items-center gap-1"><Clock size={10} />{PERIOD_TIME[period]}</span>
                </div>
                <div className="px-4 py-3 flex-1 space-y-3">
                  {!menu ? (
                    <p className="text-sm text-slate-400 italic">No menu configured.</p>
                  ) : (
                    <>
                      {mains.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                            Options (nurse selects 1 per patient)
                          </p>
                          <ol className="space-y-1.5">
                            {mains.map((item, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-slate-800">
                                <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-primary-50 border border-primary-200 flex items-center justify-center text-xs font-bold text-primary-600">
                                  {i + 1}
                                </span>
                                {item.name}
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                      {(sides.length > 0 || drinks.length > 0) && (
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                            Included with every meal
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {[...sides, ...drinks].map((item, i) => (
                              <span key={i} className="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-600">
                                {item.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
                {menu && (
                  <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-400">
                    {mains.length} option{mains.length !== 1 ? "s" : ""} · {sides.length + drinks.length} included items
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Info note */}
      <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
        <BookOpen size={16} className="text-slate-400 flex-shrink-0" />
        <p className="text-sm text-slate-500">
          This is a read-only view. To edit menus or manage VIP food options, ask an administrator.
        </p>
      </div>
    </div>
  );
}

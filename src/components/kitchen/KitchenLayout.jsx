import { useState } from "react";
import KitchenSidebar from "./KitchenSidebar";

export default function KitchenLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <KitchenSidebar mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0 lg:ml-60">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 h-14 bg-white border-b border-slate-200 sticky top-0 z-20">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <img src="/favicon_48.png" alt="Mayrit" className="w-7 h-7 rounded-md" />
            <span className="font-semibold text-slate-800 text-sm">Kitchen Portal</span>
          </div>
        </div>

        <main className="flex-1 p-4 lg:p-6 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

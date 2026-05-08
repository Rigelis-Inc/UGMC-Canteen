import { useState } from "react";
import Sidebar from "./Sidebar";

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem("sidebar.collapsed") === "true";
  });

  function handleToggleSidebar() {
    setCollapsed((prev) => {
      const next = !prev;

      if (typeof window !== "undefined") {
        window.localStorage.setItem("sidebar.collapsed", String(next));
      }

      return next;
    });
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-gray-950 transition-colors duration-200">
      <Sidebar collapsed={collapsed} onToggle={handleToggleSidebar} />
      <main
        className={`transition-all duration-300 ease-in-out pt-16 lg:pt-0 ${
          collapsed ? "lg:ml-[72px]" : "lg:ml-64"
        }`}
      >
        <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}

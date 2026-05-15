import { Link } from "react-router-dom";
import { ArrowRight, UtensilsCrossed } from "lucide-react";
import { useSiteStatus } from "../../components/public/PublicLayout";

export default function LandingPage() {
  const { orderingEnabled } = useSiteStatus();

  return (
    <section className="relative h-[100svh] flex items-center overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url("/hero-bg-v2.png")`,
          filter: "contrast(1.12) saturate(1.08) brightness(0.95)",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20" />

      <div className="relative w-full px-6 sm:px-10 lg:px-16 pb-24">
        <div className="max-w-4xl">
          {/* Status badge */}
          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] mb-5 backdrop-blur-md ${
            orderingEnabled
              ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/20"
              : "bg-red-500/15 text-red-300 ring-1 ring-red-400/20"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${orderingEnabled ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
            {orderingEnabled ? "Open now" : "Closed"}
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-white leading-[0.95] tracking-[-0.04em] mb-4">
            Fresh meals,
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-300 to-amber-300">
              made daily.
            </span>
          </h1>

          <p className="text-neutral-300/80 text-base leading-relaxed mb-8 max-w-md">
            Quality food for the UGMC community — staff, patients, visitors, and departments.
          </p>

          <Link
            to="/menu"
            className="inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-semibold px-6 py-3.5 rounded-2xl transition-all shadow-lg shadow-orange-500/25"
          >
              <UtensilsCrossed size={16} />
            Order now
          </Link>
        </div>
      </div>
    </section>
  );
}

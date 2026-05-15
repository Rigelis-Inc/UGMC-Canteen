import { Link } from "react-router-dom";
import { Phone, MapPin, Clock } from "lucide-react";

export default function PublicFooter() {
  return (
    <footer className="bg-gray-950 text-gray-500">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 pt-12 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">

          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 flex items-center justify-center bg-white shadow-md" style={{borderRadius:"50% / 45%", padding:"5px 8px"}}>
                <img src="/mayrit_logo.png" alt="Mayrit Cuisines" className="h-9 w-auto object-contain" style={{maxWidth:"62px"}} />
              </div>
              <div>
                <p className="font-bold text-white text-sm tracking-tight">
                  Mayrit<span className="text-orange-400"> Cuisines</span>
                </p>
                <p className="text-gray-600 text-[10px] font-medium">Fresh Meals Daily</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-gray-500 max-w-xs">
              Fresh, nutritious meals for the entire UGMC community.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-gray-400 font-semibold text-[10px] uppercase tracking-wider mb-4">Quick Links</h3>
            <ul className="space-y-2.5">
              {[
                { label: "Home", path: "/" },
                { label: "Menu", path: "/menu" },
                { label: "My Cart", path: "/cart" },
                { label: "Staff Login", path: "/admin/login" },
              ].map((link) => (
                <li key={link.path}>
                  <Link to={link.path} className="text-sm text-gray-500 hover:text-orange-400 transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-gray-400 font-semibold text-[10px] uppercase tracking-wider mb-4">Contact</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-2.5">
                <MapPin size={13} className="text-gray-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-500">UGMC, Legon, Accra</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone size={13} className="text-gray-600 flex-shrink-0" />
                <span className="text-sm text-gray-500">+233 30 221 0700</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Clock size={13} className="text-gray-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-gray-500">
                  <p>Mon–Sat: 7AM–9PM</p>
                  <p>Sun: 9AM–6PM</p>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-gray-600">&copy; {new Date().getFullYear()} All rights reserved.</p>
          <p className="text-xs text-gray-600">Made for the UGMC community</p>
        </div>
      </div>
    </footer>
  );
}

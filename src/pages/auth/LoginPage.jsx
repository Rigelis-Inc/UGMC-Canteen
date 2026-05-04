import { useState } from "react";
import { Navigate } from "react-router-dom";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { Mail, Lock, AlertCircle, CheckCircle2, Loader2, Eye, EyeOff, ArrowLeft, Warehouse, Shield, BarChart3, Activity } from "lucide-react";

export default function LoginPage() {
  const { loading: authLoading, currentUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [showReset, setShowReset] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 shadow-sm">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-700 border-t-primary-500" />
          <span className="text-sm font-medium text-slate-400">Loading sign-in...</span>
        </div>
      </div>
    );
  }

  if (currentUser) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
        setError("Invalid email or password. Please try again.");
      } else if (err.code === "auth/wrong-password") {
        setError("Incorrect password. Please try again.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many failed attempts. Please try again later.");
      } else if (err.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else {
        setError("Failed to sign in. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    if (!email) { setError("Enter your email address first."); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
      setError("");
    } catch {
      setError("Failed to send reset email. Check the address and try again.");
    }
  }

  const features = [
    { icon: Warehouse, label: "Multi-Store Management" },
    { icon: Activity, label: "Real-Time Stock Tracking" },
    { icon: BarChart3, label: "Reports & Analytics" },
    { icon: Shield, label: "Role-Based Access Control" },
  ];

  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900">
        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute top-1/3 -right-12 w-72 h-72 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-16 left-1/4 w-64 h-64 rounded-full bg-primary-400/20 blur-3xl" />

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          {/* Top */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                <span className="text-white font-extrabold text-sm tracking-wider">UG</span>
              </div>
              <div>
                <p className="text-white font-semibold text-base">UGMC Canteen</p>
                <p className="text-primary-200/80 text-xs">Inventory Management</p>
              </div>
            </div>
          </div>

          {/* Center */}
          <div className="flex-1 flex flex-col justify-center max-w-md">
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight tracking-tight mb-4">
              Streamline Your
              <span className="block mt-1 bg-gradient-to-r from-amber-200 to-yellow-100 bg-clip-text text-transparent">
                Inventory Workflow
              </span>
            </h1>
            <p className="text-primary-100/80 text-base leading-relaxed mb-10">
              Manage stock across multiple stores, track movements in real time, and generate detailed reports — all from one centralized platform.
            </p>

            <div className="grid grid-cols-2 gap-3">
              {features.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2.5 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10">
                  <Icon size={16} className="text-amber-200 flex-shrink-0" />
                  <span className="text-white/90 text-xs font-medium leading-tight">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom */}
          <div className="flex items-center gap-2 text-primary-200/60 text-xs">
            <div className="w-8 h-px bg-white/20" />
            <span>University of Ghana Medical Centre</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 sm:px-12 lg:px-16 xl:px-24 relative">
        {/* Mobile top branding */}
        <div className="lg:hidden absolute top-6 left-6 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-primary-600 flex items-center justify-center shadow-lg shadow-primary-600/30">
            <span className="text-white font-extrabold text-xs tracking-wider">UG</span>
          </div>
          <div>
            <p className="text-white font-semibold text-sm">UGMC Canteen</p>
          </div>
        </div>

        <div className="w-full max-w-md">
          {showReset ? (
            <div className="animate-fadeIn">
              {resetSent ? (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 size={32} className="text-green-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Reset link sent</h2>
                  <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                    Check your inbox for the link sent to{" "}
                    <span className="text-white font-medium">{email}</span>.
                  </p>
                  <button
                    onClick={() => { setShowReset(false); setResetSent(false); setError(""); }}
                    className="w-full py-3 border border-slate-700 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-800 hover:border-slate-600 transition-all"
                  >
                    Back to sign in
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => { setShowReset(false); setError(""); }}
                    className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 mb-8 transition-colors group"
                  >
                    <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                    Back to sign in
                  </button>

                  <div className="mb-8">
                    <h2 className="text-2xl font-bold text-white">Reset password</h2>
                    <p className="text-sm text-slate-400 mt-1.5">Enter your email to receive a reset link.</p>
                  </div>

                  {error && (
                    <div className="mb-6 flex items-start gap-2.5 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                      <AlertCircle size={15} className="text-red-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-red-300">{error}</p>
                    </div>
                  )}

                  <form onSubmit={handleReset} className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Email address</label>
                      <div className="relative">
                        <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 border border-slate-700 rounded-xl text-sm bg-slate-800/50 text-white focus:outline-none focus:bg-slate-800 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all placeholder:text-slate-500"
                          placeholder="you@ugmc.edu.gh"
                          required
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-primary-600 hover:bg-primary-500 text-white py-3 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-primary-600/25 hover:shadow-primary-500/30"
                    >
                      Send reset link
                    </button>
                  </form>
                </>
              )}
            </div>
          ) : (
            <div className="animate-fadeIn">
              {/* Mobile logo */}
              <div className="lg:hidden flex flex-col items-center mb-10">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-xl shadow-primary-600/30 mb-4">
                  <span className="text-white font-extrabold text-lg tracking-wide">UG</span>
                </div>
                <h1 className="text-xl font-bold text-white">UGMC Canteen</h1>
                <p className="text-sm text-slate-400 mt-1">Inventory Management System</p>
              </div>

              {/* Desktop heading */}
              <div className="hidden lg:block mb-8">
                <h2 className="text-2xl font-bold text-white">Welcome back</h2>
                <p className="text-sm text-slate-400 mt-1.5">Sign in to your account to continue.</p>
              </div>

              {error && (
                <div className="mb-6 flex items-start gap-2.5 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl animate-fadeIn">
                  <AlertCircle size={15} className="text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-slate-700 rounded-xl text-sm bg-slate-800/50 text-white focus:outline-none focus:bg-slate-800 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all placeholder:text-slate-500"
                      placeholder="you@ugmc.edu.gh"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="password" className="text-sm font-medium text-slate-300">Password</label>
                    <button
                      type="button"
                      onClick={() => { setShowReset(true); setError(""); }}
                      className="text-xs text-primary-400 hover:text-primary-300 font-medium transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-11 py-3 border border-slate-700 rounded-xl text-sm bg-slate-800/50 text-white focus:outline-none focus:bg-slate-800 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all placeholder:text-slate-500"
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white py-3 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-primary-600/25 hover:shadow-primary-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><Loader2 size={15} className="animate-spin" /> Signing in…</>
                  ) : "Sign in"}
                </button>
              </form>

              <p className="text-center text-xs text-slate-600 mt-10 leading-relaxed">
                &copy; {new Date().getFullYear()} University of Ghana Medical Centre
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

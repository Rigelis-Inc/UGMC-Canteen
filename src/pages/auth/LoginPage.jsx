import { useState } from "react";
import { Navigate } from "react-router-dom";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { Mail, Lock, AlertCircle, CheckCircle2, Loader2, Eye, EyeOff, ArrowLeft } from "lucide-react";

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

  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-5/12 relative overflow-hidden bg-gradient-to-br from-primary-600 to-primary-800">
        {/* Abstract shapes */}
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-white/5 translate-y-1/3 -translate-x-1/4" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-2xl bg-white/5 rotate-12" />
        <div className="absolute top-20 left-20 w-3 h-3 rounded-full bg-white/20" />
        <div className="absolute bottom-32 right-24 w-2 h-2 rounded-full bg-white/15" />
        <div className="absolute top-1/3 right-16 w-2 h-2 rounded-full bg-white/10" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Top spacer */}
          <div />

          {/* Center */}

          {/* Center */}
          <div className="flex flex-col items-center text-center">
            <h1 className="text-7xl font-bold text-white tracking-tight mb-3">UGMC</h1>
            <p className="text-3xl font-medium text-primary-200/80 tracking-wide">Canteen</p>
            <div className="w-20 h-px bg-white/20 mt-10 mb-8" />
            <p className="text-primary-100/50 text-lg tracking-wide">Inventory Management System</p>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 sm:px-12 lg:px-16 relative">
        {/* Mobile top branding */}
        <div className="lg:hidden absolute top-6 left-6 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-primary-600 flex items-center justify-center shadow-lg shadow-primary-600/30">
            <span className="text-white font-extrabold text-xs tracking-wider">UG</span>
          </div>
          <p className="text-white font-semibold text-sm">UGMC Canteen</p>
        </div>

        <div className="w-full max-w-sm">
          {showReset ? (
            <div className="animate-fadeIn">
              {resetSent ? (
                <div className="text-center">
                  <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-5">
                    <CheckCircle2 size={28} className="text-green-400" />
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">Reset link sent</h2>
                  <p className="text-slate-400 text-sm mb-8">
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
                    Back
                  </button>

                  <div className="mb-8">
                    <h2 className="text-xl font-bold text-white">Reset password</h2>
                    <p className="text-sm text-slate-400 mt-1">Enter your email to receive a reset link.</p>
                  </div>

                  {error && (
                    <div className="mb-6 flex items-start gap-2.5 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                      <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-red-300">{error}</p>
                    </div>
                  )}

                  <form onSubmit={handleReset} className="space-y-4">
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
                      className="w-full bg-primary-600 hover:bg-primary-500 text-white py-3 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-primary-600/25"
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
              <div className="lg:hidden flex flex-col items-center mb-8">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-xl shadow-primary-600/30 mb-3">
                  <span className="text-white font-extrabold text-sm tracking-wide">UG</span>
                </div>
              </div>

              {/* Desktop heading */}
              <div className="hidden lg:block mb-8">
                <h2 className="text-xl font-bold text-white">Welcome back</h2>
                <p className="text-sm text-slate-400 mt-1">Sign in to your account.</p>
              </div>

              {error && (
                <div className="mb-6 flex items-start gap-2.5 p-3 bg-red-500/10 border border-red-500/20 rounded-xl animate-fadeIn">
                  <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
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
                  className="w-full bg-primary-600 hover:bg-primary-500 text-white py-3 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-primary-600/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><Loader2 size={15} className="animate-spin" /> Signing in…</>
                  ) : "Sign in"}
                </button>
              </form>

              <p className="text-center text-xs text-slate-600 mt-10">
                &copy; {new Date().getFullYear()} UGMC Canteen
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

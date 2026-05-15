import { useState } from "react";
import { Navigate } from "react-router-dom";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { getRoleHomePath } from "../../lib/permissions";
import {
  Mail,
  Lock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
  ArrowLeft,
} from "lucide-react";

export default function LoginPage() {
  const { loading: authLoading, currentUser, userProfile } = useAuth();
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

  if (currentUser && !userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-6">
        <div className="w-full max-w-[360px] rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-500/10 text-primary-300">
            <Loader2 size={20} className="animate-spin" />
          </div>
          <h2 className="text-lg font-bold text-white">Loading your account</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            We found a signed-in user, but the profile is still loading. If this stays here, reload the page.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-800"
              >
                Reload page
              </button>
          </div>
        </div>
      </div>
    );
  }

  if (currentUser && userProfile) {
    return <Navigate to={getRoleHomePath(userProfile.role)} replace />;
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
    if (!email) {
      setError("Enter your email address first.");
      return;
    }
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
      <div
        className="hidden lg:flex lg:w-[38%] relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #ea6a10 0%, #c94f00 100%)" }}
      >
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[320px] h-[320px] rounded-full bg-white/10 blur-3xl" />
        </div>
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full border border-white/10" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full border border-white/10" />

        <div className="relative z-10 flex flex-col items-center justify-center w-full h-full px-8 py-12">
          <div className="flex items-center justify-center mb-6">
            <div
              className="flex items-center justify-center"
              style={{
                background: "white",
                borderRadius: "50% / 45%",
                padding: "14px 22px",
                boxShadow: "0 10px 36px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12)",
              }}
            >
              <img
                src="/mayrit_logo.png"
                alt="Mayrit Cuisines Limited"
                className="w-[180px] h-auto object-contain"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 w-36 mb-5">
            <div className="flex-1 h-px bg-white/20" />
            <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
            <div className="flex-1 h-px bg-white/20" />
          </div>

          <p className="text-white/45 text-[9px] tracking-[0.22em] uppercase font-semibold text-center">
            Inventory Management System
          </p>
        </div>

        <p className="absolute bottom-5 left-0 right-0 text-center text-white/25 text-xs">
          &copy; {new Date().getFullYear()} Mayrit Cuisines Limited
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-10 sm:px-12 lg:px-12">
        <div className="w-full max-w-[340px] lg:max-w-sm">
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
                    onClick={() => {
                      setShowReset(false);
                      setResetSent(false);
                      setError("");
                    }}
                    className="w-full py-3 border border-slate-700 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-800 hover:border-slate-600 transition-all"
                  >
                    Back to sign in
                  </button>
                </div>
              ) : (
                <>
                  <div className="lg:hidden flex justify-center mb-6">
                    <div className="flex items-center justify-center rounded-2xl bg-white/10 p-3">
                      <img src="/mayrit_logo.png" alt="Mayrit Cuisines" className="h-12 w-auto object-contain" />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowReset(false);
                      setError("");
                    }}
                    className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 mb-6 transition-colors group"
                  >
                    <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                    Back to sign in
                  </button>

                  <div className="mb-6">
                    <h2 className="text-lg lg:text-xl font-bold text-white">Reset password</h2>
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
              <div className="lg:hidden flex flex-col items-center mb-8">
                <div className="mb-5 flex items-center justify-center rounded-2xl bg-white/10 p-4">
                  <img
                    src="/mayrit_logo.png"
                    alt="Mayrit Cuisines"
                    className="h-16 w-auto object-contain"
                    style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.25))" }}
                  />
                </div>
                <h2 className="text-xl font-bold text-white">Welcome back</h2>
                <p className="mt-1 text-sm text-slate-400">Sign in to your account</p>
              </div>

              <div className="hidden lg:block mb-6">
                <h2 className="text-lg lg:text-xl font-bold text-white">Welcome back</h2>
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
                    <label htmlFor="password" className="text-sm font-medium text-slate-300">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowReset(true);
                        setError("");
                      }}
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
                    <>
                      <Loader2 size={15} className="animate-spin" /> Signing in...
                    </>
                  ) : (
                    "Sign in"
                  )}
                </button>
              </form>

              <p className="text-center text-xs text-slate-600 mt-10">
                &copy; {new Date().getFullYear()} Mayrit Cuisines
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


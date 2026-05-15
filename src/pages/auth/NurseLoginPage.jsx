import { useState } from "react";
import { Navigate } from "react-router-dom";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { getNurseLoginRedirectPath } from "../../lib/permissions";
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

export default function NurseLoginPage() {
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
      <div
        className="min-h-screen flex flex-col items-center justify-center px-4 py-8 lg:py-6"
        style={{ background: "linear-gradient(160deg, #ea6a10 0%, #c94f00 100%)" }}
      >
        <div className="relative z-10 w-full max-w-sm lg:max-w-[340px]">
          <div className="bg-white/95 rounded-2xl shadow-lg border border-white/50 p-6 lg:p-5 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
              <Loader2 size={20} className="animate-spin" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Loading your account</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              We found a signed-in user, but the profile is still loading. If this stays here, reload the page.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentUser && userProfile) {
    return <Navigate to={getNurseLoginRedirectPath(userProfile.role)} replace />;
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
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-8 lg:py-6"
      style={{ background: "linear-gradient(160deg, #ea6a10 0%, #c94f00 100%)" }}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-28 -right-28 w-[420px] h-[420px] rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-36 -left-36 w-[500px] h-[500px] rounded-full bg-black/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm lg:max-w-[340px]">
        <div className="text-center mb-6 lg:mb-5">
          <div className="flex items-center justify-center mb-4 lg:mb-5">
            <div
              style={{
                background: "white",
                borderRadius: "50% / 45%",
                padding: "14px 22px",
                boxShadow: "0 8px 28px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.10)",
              }}
            >
              <img
                src="/mayrit_logo.png"
                alt="Mayrit Cuisines"
                className="w-[160px] lg:w-[150px] h-auto object-contain"
              />
            </div>
          </div>
          <h1 className="text-xl lg:text-lg font-bold text-white tracking-tight">Ward Meal Ordering</h1>
        </div>

        <div className="bg-white/95 rounded-2xl shadow-lg border border-white/50 p-6 lg:p-5">
          {showReset ? (
            <>
              {resetSent ? (
                <div className="text-center py-4">
                  <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={26} className="text-green-600" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 mb-2">Reset link sent</h2>
                  <p className="text-sm text-slate-500 mb-6">
                    Check your inbox for the link sent to{" "}
                    <span className="font-medium text-slate-700">{email}</span>.
                  </p>
                  <button
                    onClick={() => {
                      setShowReset(false);
                      setResetSent(false);
                      setError("");
                    }}
                    className="w-full py-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Back to sign in
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setShowReset(false);
                      setError("");
                    }}
                    className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 mb-6 transition-colors group"
                  >
                    <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                    Back to sign in
                  </button>
                  <h2 className="text-lg font-bold text-slate-900 mb-1">Reset your password</h2>
                  <p className="text-sm text-slate-500 mb-6">Enter your email to receive a reset link.</p>

                  {error && (
                    <div className="mb-4 flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl">
                      <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-red-600">{error}</p>
                    </div>
                  )}

                  <form onSubmit={handleReset} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
                      <div className="relative">
                        <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-900 focus:outline-none focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all placeholder:text-slate-400"
                          placeholder="you@ugmc.edu.gh"
                          required
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-xl text-sm font-semibold transition-all shadow-md shadow-primary-600/20"
                    >
                      Send reset link
                    </button>
                  </form>
                </>
              )}
            </>
          ) : (
            <>
              {error && (
                <div className="mb-5 flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-900 focus:outline-none focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all placeholder:text-slate-400"
                      placeholder="you@ugmc.edu.gh"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="password" className="text-sm font-semibold text-slate-700">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowReset(true);
                        setError("");
                      }}
                      className="text-xs text-primary-600 hover:text-primary-700 font-medium transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-11 py-3 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-900 focus:outline-none focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all placeholder:text-slate-400"
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white py-3.5 rounded-xl text-sm font-semibold transition-all shadow-md shadow-primary-600/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign in"
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-[11px] text-white/40 mt-3">
          &copy; {new Date().getFullYear()} Mayrit Cuisines Limited
        </p>
      </div>
    </div>
  );
}

import React from "react";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";
import { auth } from "../../config/firebase";
import { resetBrowserSession } from "../../lib/sessionRecovery";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, info) {
    console.error("Application render error:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetSession = async () => {
    await resetBrowserSession(auth);
    const loginPath = window.location.pathname.startsWith("/admin") ? "/admin/login" : "/login";
    window.location.replace(loginPath);
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <AlertTriangle size={22} />
          </div>
          <h1 className="text-lg font-semibold text-slate-900">Something stopped rendering</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            The app hit an unexpected error. Reload to try again, or reset the session to clear stale browser state.
          </p>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
            >
              <RefreshCw size={15} />
              Reload page
            </button>
            <button
              type="button"
              onClick={this.handleResetSession}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
            >
              <RotateCcw size={15} />
              Reset session
            </button>
          </div>
        </div>
      </div>
    );
  }
}

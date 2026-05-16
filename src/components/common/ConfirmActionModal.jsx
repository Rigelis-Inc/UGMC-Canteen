import { useEffect } from "react";
import { AlertTriangle, X, Loader2 } from "lucide-react";

export default function ConfirmActionModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "warning",
  icon: Icon = AlertTriangle,
  loading = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onCancel?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const confirmButtonStyles =
    tone === "danger"
      ? "bg-red-600 hover:bg-red-700 focus:ring-red-500/30"
      : tone === "success"
      ? "bg-green-600 hover:bg-green-700 focus:ring-green-500/30"
      : tone === "brand"
      ? "bg-primary-600 hover:bg-primary-700 focus:ring-primary-500/30"
      : "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500/30";

  const iconWrapStyles =
    tone === "danger"
      ? "bg-red-50 text-red-600"
      : tone === "success"
      ? "bg-green-50 text-green-600"
      : tone === "brand"
      ? "bg-primary-50 text-primary-600"
      : "bg-amber-50 text-amber-600";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel?.();
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl ${iconWrapStyles}`}>
              <Icon size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
              <p className="mt-1 text-sm text-gray-500">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-3 px-6 py-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-all focus:outline-none focus:ring-4 disabled:opacity-80 disabled:cursor-wait ${confirmButtonStyles}`}
          >
            {loading ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                <span className="relative inline-flex h-2 w-2 overflow-hidden rounded-full bg-white/60">
                  <span className="absolute inset-0 -translate-x-full animate-[shimmer_1s_infinite] bg-gradient-to-r from-transparent via-white/80 to-transparent" />
                </span>
                Processing…
              </span>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

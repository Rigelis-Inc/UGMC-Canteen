import { useState } from "react";
import { CheckCircle2, XCircle, Loader2, RotateCw } from "lucide-react";
import { sendDeliveredMealSms } from "../../lib/mealSms";

const SMS_STATUS_CONFIG = {
  SENT: {
    label: "SMS dispatched",
    icon: CheckCircle2,
    bg: "bg-blue-50 border-blue-200 text-blue-700",
    dot: "bg-blue-500",
  },
  FAILED: {
    label: "SMS failed",
    icon: XCircle,
    bg: "bg-red-50 border-red-200 text-red-700",
    dot: "bg-red-500",
  },
  PROCESSING: {
    label: "SMS sending...",
    icon: Loader2,
    bg: "bg-amber-50 border-amber-200 text-amber-700",
    dot: "bg-amber-500",
  },
};

export default function SmsStatusBadge({ order, onRetry, size = "sm" }) {
  const [retrying, setRetrying] = useState(false);
  const status = order?.smsDeliveredStatus;
  const config = SMS_STATUS_CONFIG[status];
  const Icon = config?.icon;

  if (!status || !config) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md ${size === "xs" ? "text-[10px]" : "text-xs"} font-medium border ${config.bg}`}
      >
        <Icon size={size === "xs" ? 10 : 12} className={status === "PROCESSING" ? "animate-spin" : ""} />
        {config.label}
      </span>
      {status === "FAILED" && onRetry && (
        <button
          onClick={async (e) => {
            e.stopPropagation();
            setRetrying(true);
            try {
              await sendDeliveredMealSms(order);
              if (onRetry) await onRetry(order);
            } catch (err) {
              console.warn("SMS retry failed:", err);
            } finally {
              setRetrying(false);
            }
          }}
          disabled={retrying}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ${size === "xs" ? "text-[10px]" : "text-xs"} font-medium text-primary-700 bg-primary-50 border border-primary-200 hover:bg-primary-100 disabled:opacity-50 transition-colors`}
        >
          {retrying ? (
            <Loader2 size={size === "xs" ? 10 : 11} className="animate-spin" />
          ) : (
            <RotateCw size={size === "xs" ? 10 : 11} />
          )}
          Retry
        </button>
      )}
    </div>
  );
}

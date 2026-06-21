import { Loader2, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { clsx } from "clsx";

interface StatusBadgeProps {
  status: "pending" | "processing" | "completed" | "failed";
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = {
    pending: {
      color: "bg-yellow-500/10 text-yellow-600 border-yellow-200",
      icon: Clock,
      label: "Pending",
      spin: false,
    },
    processing: {
      color: "bg-blue-500/10 text-blue-600 border-blue-200",
      icon: Loader2,
      label: "Processing",
      spin: true,
    },
    completed: {
      color: "bg-green-500/10 text-green-600 border-green-200",
      icon: CheckCircle2,
      label: "Completed",
      spin: false,
    },
    failed: {
      color: "bg-red-500/10 text-red-600 border-red-200",
      icon: AlertCircle,
      label: "Failed",
      spin: false,
    },
  };

  const { color, icon: Icon, label, spin } = config[status];

  return (
    <div className={clsx(
      "inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border",
      color,
      className
    )}>
      <Icon className={clsx("w-4 h-4", spin && "animate-spin")} />
      {label}
    </div>
  );
}

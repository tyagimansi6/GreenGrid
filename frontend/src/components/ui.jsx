import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";

const STATUS = {
  normal: {
    label: "Normal",
    icon: CircleCheck,
    chip: "bg-moss/10 text-moss",
    edge: "border-moss",
  },
  warning: {
    label: "Warning",
    icon: TriangleAlert,
    chip: "bg-honey/15 text-honey",
    edge: "border-honey",
  },
  critical: {
    label: "Critical",
    icon: CircleAlert,
    chip: "bg-crit/10 text-crit",
    edge: "border-crit",
  },
};

export function statusMeta(status) {
  return STATUS[status] || STATUS.critical;
}

export function StatusBadge({ status }) {
  const meta = statusMeta(status);
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.chip}`}>
      <Icon size={14} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

export function Meter({ utilization, warningRatio = 0.8, criticalRatio = 0.95 }) {
  const width = Math.min(Math.max(utilization, 0), 1) * 100;
  const meta = utilization >= criticalRatio ? STATUS.critical : utilization >= warningRatio ? STATUS.warning : STATUS.normal;
  const bar = utilization >= criticalRatio ? "bg-crit" : utilization >= warningRatio ? "bg-honey" : "bg-moss";
  return (
    <div
      className="relative h-2 w-full rounded-full bg-ink/10"
      role="img"
      aria-label={`${Math.round(utilization * 100)} percent of the contract limit, ${meta.label}`}
    >
      <div className={`h-2 rounded-full ${bar}`} style={{ width: `${width}%` }} />
      <span className="absolute -top-0.5 h-3 w-px bg-honey" style={{ left: `${warningRatio * 100}%` }} />
      <span className="absolute -top-0.5 h-3 w-px bg-crit" style={{ left: `${Math.min(criticalRatio, 1) * 100}%` }} />
    </div>
  );
}

export function LivePulse({ updatedAt, light = false }) {
  if (!updatedAt) return null;
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ${
        light ? "bg-white/10 text-white/80" : "bg-white text-mist shadow-sm"
      }`}
    >
      <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${light ? "bg-lime" : "bg-moss"}`} />
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${light ? "bg-lime" : "bg-moss"}`} />
      </span>
      Live · {updatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}
    </div>
  );
}

export function PageHeader({ eyebrow, title, lede, updatedAt }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">{eyebrow}</p>
        <h1 className="mt-1 font-display font-bold text-4xl leading-none tracking-tight md:text-5xl">{title}</h1>
        {lede && <p className="mt-3 text-sm leading-6 text-mist">{lede}</p>}
      </div>
      <LivePulse updatedAt={updatedAt} />
    </header>
  );
}

export function LoadingState() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading GreenGrid">
      <div className="h-44 animate-pulse rounded-[28px] bg-white/80" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-80 animate-pulse rounded-[28px] bg-white/80 lg:col-span-2" />
        <div className="h-80 animate-pulse rounded-[28px] bg-white/80" />
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="rounded-[28px] bg-white p-8 shadow-card" role="alert">
      <h2 className="font-display font-bold text-3xl">The GreenGrid API is offline</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-mist">{message}</p>
      <p className="mt-2 max-w-xl text-sm leading-6 text-mist">
        Start Django from the backend folder, then retry. The Vite dev server proxies /api to port 8000.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white"
      >
        Retry
      </button>
    </div>
  );
}

export function StaleBanner({ message }) {
  if (!message) return null;
  return (
    <p className="mb-4 rounded-2xl bg-honey/15 px-4 py-2 text-sm text-honey" role="status">
      Showing the last reading. {message}
    </p>
  );
}

const shellClass =
  "mt-1.5 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink transition focus-within:border-moss";

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mist">{label}</span>
      <div className={shellClass}>{children}</div>
      {hint && <span className="mt-1 block text-xs leading-5 text-mist">{hint}</span>}
    </label>
  );
}

export function TextInput(props) {
  return <input {...props} className="w-full min-w-0 bg-transparent outline-none" />;
}

export function Panel({ className = "", children }) {
  return <section className={`rounded-[28px] bg-white p-5 shadow-card md:p-6 ${className}`}>{children}</section>;
}

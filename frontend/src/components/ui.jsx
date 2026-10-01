import { statusMeta, default as StatusBadge } from "./StatusBadge";

export { statusMeta, StatusBadge };

export function Meter({ utilization, warningRatio = 0.8, criticalRatio = 0.95 }) {
  const width = Math.min(Math.max(utilization, 0), 1) * 100;
  const meta = utilization >= criticalRatio ? statusMeta("critical") : utilization >= warningRatio ? statusMeta("warning") : statusMeta("normal");
  const bar = utilization >= criticalRatio ? "bg-crit" : utilization >= warningRatio ? "bg-honey" : "bg-canopy";
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
      className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs ${
        light ? "bg-white/10 text-ivory/80" : "border border-line bg-surface text-mist"
      }`}
    >
      <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${light ? "bg-sage" : "bg-canopy"}`} />
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${light ? "bg-sage" : "bg-canopy"}`} />
      </span>
      Live · {updatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}
    </div>
  );
}

export function PageHeader({ eyebrow, title, lede, updatedAt }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 rounded-lg border border-line bg-surface px-4 py-3">
      <div className="max-w-2xl">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-mist">{eyebrow}</p>
        <h1 className="mt-1 font-display text-3xl font-semibold leading-tight tracking-tight md:text-4xl">{title}</h1>
        {lede && <p className="mt-3 text-sm leading-6 text-mist">{lede}</p>}
      </div>
      <LivePulse updatedAt={updatedAt} />
    </header>
  );
}

export function LoadingState() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading GreenGrid">
      <div className="h-28 animate-pulse rounded-lg border border-line bg-surface" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-80 animate-pulse rounded-lg border border-line bg-surface lg:col-span-2" />
        <div className="h-80 animate-pulse rounded-lg border border-line bg-surface" />
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-8 shadow-card" role="alert">
      <h2 className="font-display text-2xl font-semibold">The GreenGrid API is offline</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-mist">{message}</p>
      <p className="mt-2 max-w-xl text-sm leading-6 text-mist">
        Start Django from the backend folder, then retry. The Vite dev server proxies /api to port 8000.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 rounded-md bg-ink px-4 py-2 text-sm font-medium text-ivory"
      >
        Retry
      </button>
    </div>
  );
}

export function StaleBanner({ message }) {
  if (!message) return null;
  return (
    <p className="mb-4 rounded-md bg-honey/15 px-4 py-2 text-sm text-honey" role="status">
      Showing the last reading. {message}
    </p>
  );
}

const shellClass =
  "mt-1.5 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink transition focus-within:border-bronze";

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
  return <section className={`rounded-lg border border-line bg-surface p-5 shadow-card md:p-6 ${className}`}>{children}</section>;
}

import { Link } from "react-router-dom";
import { api } from "../api";
import { ErrorState, LoadingState, PageHeader, Panel, StaleBanner, StatusBadge } from "../components/ui";
import { formatAgo, formatNumber, formatPercent, headroomText } from "../format";
import { useDocumentTitle, usePoll } from "../hooks";

export default function Alerts() {
  useDocumentTitle("Alerts");
  const { data, error, loading, updatedAt, reload } = usePoll(api.alerts, 5000);

  if (loading && !data) return <LoadingState />;
  if (!data) return <ErrorState message={error} onRetry={reload} />;

  const alerts = data.alerts;

  return (
    <div>
      <PageHeader
        eyebrow="Alerts"
        title={alerts.length ? `${alerts.length} site${alerts.length === 1 ? "" : "s"} need attention` : "All clear"}
        lede="Warning starts at each site's warning line. Critical starts at the critical line, and stays on if the meter crosses the contract."
        updatedAt={updatedAt}
      />
      <StaleBanner message={error} />
      {alerts.length === 0 ? (
        <Panel>
          <h2 className="font-display text-2xl font-semibold">Every site is inside its warning line.</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-mist">
            GreenGrid will raise a warning when a meter reaches the warning threshold, and a critical alert as it closes on the contract limit.
          </p>
        </Panel>
      ) : (
        <ul className="space-y-3">
          {alerts.map((site) => (
            <li key={site.code}>
              <article className="rounded-lg border border-line bg-surface p-5 shadow-card md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mist">
                      {site.facility_type} · {site.location}
                    </p>
                    <h2 className="mt-1 font-display text-2xl font-bold tracking-tight">{site.name}</h2>
                  </div>
                  <StatusBadge status={site.status} />
                </div>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/80">{site.message}</p>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                  <div className="rounded-md bg-paper px-3 py-3">
                    <dt className="text-xs text-mist">Metered now</dt>
                    <dd className="num mt-1 text-xl font-semibold">{formatNumber(site.grid_kw)} kW</dd>
                  </div>
                  <div className="rounded-md bg-paper px-3 py-3">
                    <dt className="text-xs text-mist">Contract</dt>
                    <dd className="num mt-1 text-xl font-semibold">{formatNumber(site.contracted_limit_kw)} kW</dd>
                  </div>
                  <div className="rounded-md bg-paper px-3 py-3">
                    <dt className="text-xs text-mist">Since</dt>
                    <dd className="mt-1 text-xl font-semibold">{formatAgo(site.since)}</dd>
                    <dd className="text-xs text-mist">{formatPercent(site.utilization)} of limit · {headroomText(site.headroom_kw)}</dd>
                  </div>
                </dl>
                <Link to={`/facilities/${site.code}`} className="mt-4 inline-block text-sm font-semibold text-moss">
                  Open {site.name}
                </Link>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

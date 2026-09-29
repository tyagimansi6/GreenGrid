import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { api } from "../api";
import { DemandChart } from "../components/Charts";
import { ErrorState, LivePulse, LoadingState, Meter, Panel, StaleBanner, StatusBadge } from "../components/ui";
import { formatMoney, formatNumber, formatPercent, headroomText } from "../format";
import { useDocumentTitle, usePoll } from "../hooks";

const INTRO_KEY = "greengrid-intro";

function introHidden() {
  try {
    return localStorage.getItem(INTRO_KEY) === "1";
  } catch {
    return false;
  }
}

export default function Dashboard() {
  useDocumentTitle("Overview");
  const { data, error, loading, updatedAt, reload } = usePoll(api.dashboard, 5000);
  const [hideIntro, setHideIntro] = useState(introHidden);

  if (loading && !data) return <LoadingState />;
  if (!data) return <ErrorState message={error} onRetry={reload} />;

  const { kpis, portfolio, facilities, alerts } = data;
  const headroomLow = kpis.headroom_kw < 0;

  return (
    <div>
      <StaleBanner message={error} />
      {!hideIntro && (
        <section className="mb-4 flex flex-wrap items-start justify-between gap-4 rounded-[28px] border border-line bg-white px-5 py-4 shadow-card">
          <p className="max-w-3xl text-sm leading-6 text-ink/80">
            Utilities cap how hard a building can draw power. That cap is a demand limit in kilowatts. Cross it, and the bill picks up a penalty; equipment and the local grid take the strain too. GreenGrid compares each meter with its contract and marks the site Normal, Warning, or Critical. Energy over time is kept in kilowatt-hours for the bill.
          </p>
          <button
            type="button"
            className="rounded-full bg-paper px-3 py-1.5 text-sm font-medium"
            onClick={() => {
              try {
                localStorage.setItem(INTRO_KEY, "1");
              } catch {
                /* ignore private-mode storage failures */
              }
              setHideIntro(true);
            }}
          >
            Got it
          </button>
        </section>
      )}

      <section className="overflow-hidden rounded-[28px] bg-ink text-white shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4 px-6 pt-6 md:px-8 md:pt-8">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lime">Portfolio live</p>
            <h1 className="mt-2 font-display font-bold text-4xl leading-tight md:text-5xl">Every site, measured against its contract.</h1>
          </div>
          <LivePulse updatedAt={updatedAt} light />
        </div>
        <dl className="mt-8 grid border-t border-white/10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="border-white/10 px-6 py-5 md:px-8 sm:border-r">
            <dt className="text-[11px] uppercase tracking-[0.14em] text-white/50">Metered demand</dt>
            <dd className="num mt-2 text-3xl font-semibold">
              {formatNumber(kpis.live_grid_kw)}
              <span className="ml-1 text-base font-medium text-white/50">kW</span>
            </dd>
            <p className="mt-1 text-xs text-white/50">of {formatNumber(kpis.contract_limit_kw)} kW contracted</p>
          </div>
          <div className="border-white/10 px-6 py-5 md:px-8 lg:border-r">
            <dt className="text-[11px] uppercase tracking-[0.14em] text-white/50">Alert mix</dt>
            <dd className="mt-2 text-sm leading-6">
              <span className="num text-2xl font-semibold text-[#ffb4b4]">{kpis.critical}</span> critical
              <span className="mx-2 text-white/30">·</span>
              <span className="num text-2xl font-semibold text-[#f3d48a]">{kpis.warning}</span> warning
            </dd>
            <p className="mt-1 text-xs text-white/50">{kpis.normal} sites inside the warning line</p>
          </div>
          <div className="border-white/10 px-6 py-5 md:px-8 sm:border-r sm:border-t lg:border-t-0">
            <dt className="text-[11px] uppercase tracking-[0.14em] text-white/50">Contract headroom</dt>
            <dd className={`num mt-2 text-3xl font-semibold ${headroomLow ? "text-[#ffb4b4]" : "text-lime"}`}>
              {formatNumber(kpis.headroom_kw)}
              <span className="ml-1 text-base font-medium text-white/50">kW</span>
            </dd>
            <p className="mt-1 text-xs text-white/50">{headroomLow ? "Portfolio is over the combined limit" : "Room before the combined limit"}</p>
          </div>
          <div className="border-white/10 px-6 py-5 md:px-8 sm:border-t lg:border-t-0">
            <dt className="text-[11px] uppercase tracking-[0.14em] text-white/50">Energy, last 24 h</dt>
            <dd className="num mt-2 text-3xl font-semibold">
              {formatNumber(kpis.grid_kwh_24h)}
              <span className="ml-1 text-base font-medium text-white/50">kWh</span>
            </dd>
            <p className="mt-1 text-xs text-white/50">{formatPercent(kpis.renewable_share_24h)} of load covered by solar</p>
          </div>
        </dl>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <div className="mb-4">
            <h2 className="font-display text-lg font-semibold">Portfolio demand, last 24 hours</h2>
            <p className="mt-1 text-sm text-mist">Amber is the combined warning line. Red is the sum of the contract limits.</p>
          </div>
          <DemandChart data={portfolio.series} limit={portfolio.limit_kw} warning={portfolio.warning_kw} />
        </Panel>
        <Panel>
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">Needs a look</h2>
            <Link to="/alerts" className="text-sm font-medium text-moss">
              All alerts
            </Link>
          </div>
          {alerts.length === 0 ? (
            <p className="text-sm leading-6 text-mist">Every site is inside its warning line.</p>
          ) : (
            <ul className="space-y-3">
              {alerts.slice(0, 4).map((site) => (
                <li key={site.code}>
                  <Link to={`/facilities/${site.code}`} className="block rounded-2xl bg-paper px-3 py-3 transition hover:bg-ink/[0.04]">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-display font-semibold">{site.name}</span>
                      <StatusBadge status={site.status} />
                    </span>
                    <span className="mt-1 block text-sm text-mist">
                      {formatNumber(site.grid_kw)} kW · {headroomText(site.headroom_kw)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 border-t border-line pt-4 text-sm text-mist">
            Estimated overrun this week{" "}
            <span className="num font-semibold text-ink">{formatMoney(kpis.penalty_7d)}</span>
          </p>
        </Panel>
      </div>

      <div className="mb-3 mt-8 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-3xl">Sites</h2>
          <p className="mt-1 text-sm text-mist">The bar fills toward the contract limit. Amber tick is warning, red tick is critical.</p>
        </div>
        <Link to="/facilities" className="inline-flex items-center gap-1 text-sm font-medium text-moss">
          Compare <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {facilities.map((site) => {
          const tone = site.status === "critical" ? "bg-crit" : site.status === "warning" ? "bg-honey" : "bg-moss";
          return (
            <li key={site.code}>
              <Link
                to={`/facilities/${site.code}`}
                className="relative block h-full rounded-[24px] border border-line bg-white p-5 pl-6 shadow-card transition hover:-translate-y-0.5"
              >
                <span className={`absolute bottom-5 left-0 top-5 w-1 rounded-full ${tone}`} aria-hidden="true" />
                <span className="flex items-start justify-between gap-3">
                  <span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mist">{site.facility_type}</span>
                    <span className="mt-1 block font-display text-lg font-semibold leading-tight">{site.name}</span>
                    <span className="mt-0.5 block text-sm text-mist">{site.location}</span>
                  </span>
                  <StatusBadge status={site.status} />
                </span>
                <span className="num mt-4 block text-3xl font-semibold">{formatNumber(site.grid_kw)}</span>
                <span className="text-sm text-mist">kW metered · limit {formatNumber(site.contracted_limit_kw)} kW</span>
                <span className="mt-3 block">
                  <Meter utilization={site.utilization} warningRatio={site.warning_ratio} criticalRatio={site.critical_ratio} />
                </span>
                <span className="mt-2 block text-sm text-mist">{headroomText(site.headroom_kw)} · {formatPercent(site.utilization)} used</span>
                <span className="mt-3 block text-xs leading-5 text-mist">{site.forecast_note}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

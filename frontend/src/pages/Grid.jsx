import { Link } from "react-router-dom";
import { api } from "../api";
import { DemandChart } from "../components/Charts";
import KpiCard from "../components/KpiCard";
import SectionHeader from "../components/SectionHeader";
import StatusBadge from "../components/StatusBadge";
import { ErrorState, LoadingState, Panel, StaleBanner } from "../components/ui";
import { formatNumber, headroomText } from "../format";
import { useDocumentTitle, usePoll } from "../hooks";

export default function Grid() {
  useDocumentTitle("Grid");
  const { data, error, loading, reload } = usePoll(api.dashboard, 5000);

  if (loading && !data) return <LoadingState />;
  if (!data) return <ErrorState message={error} onRetry={reload} />;

  const { kpis, portfolio, facilities } = data;

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Grid"
        title="Import against the contract"
        detail="Each site has a utility demand limit in kilowatts. Cross it, and the bill picks up a penalty. The lines below are the portfolio warning threshold and the sum of those limits."
      />
      <StaleBanner message={error} />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Grid import" value={formatNumber(kpis.live_grid_kw)} unit="kW" detail="Metered now" />
        <KpiCard label="Contract limit" value={formatNumber(kpis.contract_limit_kw)} unit="kW" detail="Sum of site contracts" />
        <KpiCard
          label="Headroom"
          value={formatNumber(kpis.headroom_kw)}
          unit="kW"
          detail={kpis.headroom_kw < 0 ? "Portfolio is over the combined limit" : "Room under the combined limit"}
        />
        <KpiCard label="Alert mix" value={`${kpis.critical} / ${kpis.warning}`} detail="Critical / warning sites" />
      </section>
      <Panel>
        <h2 className="font-display text-lg font-semibold">Portfolio demand, last 24 hours</h2>
        <div className="mt-4">
          <DemandChart data={portfolio.series} limit={portfolio.limit_kw} warning={portfolio.warning_kw} />
        </div>
      </Panel>
      <ul className="grid gap-3 md:grid-cols-2">
        {facilities.map((site) => (
          <li key={site.code}>
            <Link to={`/facilities/${site.code}`} className="block rounded-lg border border-line bg-surface p-4 shadow-card">
              <span className="flex items-start justify-between gap-3">
                <span>
                  <span className="font-display font-semibold">{site.name}</span>
                  <span className="mt-0.5 block text-sm text-mist">{site.location}</span>
                </span>
                <StatusBadge status={site.status} />
              </span>
              <span className="num mt-3 block text-2xl font-semibold">{formatNumber(site.grid_kw)} kW</span>
              <span className="text-sm text-mist">
                Limit {formatNumber(site.contracted_limit_kw)} kW · {headroomText(site.headroom_kw)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

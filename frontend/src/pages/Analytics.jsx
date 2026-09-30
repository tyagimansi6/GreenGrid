import { Link } from "react-router-dom";
import { api } from "../api";
import KpiCard from "../components/KpiCard";
import SectionHeader from "../components/SectionHeader";
import StatusBadge from "../components/StatusBadge";
import { ErrorState, LoadingState, Meter, StaleBanner } from "../components/ui";
import { formatMoney, formatNumber, formatPercent } from "../format";
import { useDocumentTitle, usePoll } from "../hooks";
import { carbonTonnesFromSolar, coverRatio } from "../metrics";

export default function Analytics() {
  useDocumentTitle("Analytics");
  const dash = usePoll(api.dashboard, 15000);
  const bill = usePoll(api.billing, 15000);

  if (dash.loading && !dash.data) return <LoadingState />;
  if (!dash.data) return <ErrorState message={dash.error} onRetry={dash.reload} />;

  const { kpis, facilities } = dash.data;
  const ranked = [...facilities].sort((a, b) => b.utilization - a.utilization);
  const carbon = carbonTonnesFromSolar(kpis.solar_kwh_24h);

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Analytics"
        title="How the portfolio is running"
        detail="Contract position, on-site cover, and the cost of the trailing week."
      />
      <StaleBanner message={dash.error} />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Solar cover" value={formatPercent(kpis.renewable_share_24h)} detail="Solar kilowatt-hours ÷ building load" />
        <KpiCard label="Carbon avoided" value={formatNumber(carbon, 1)} unit="t" detail="Estimate from metered solar" />
        <KpiCard label="Sites off-normal" value={String(kpis.warning + kpis.critical)} detail={`${kpis.critical} critical · ${kpis.warning} warning`} />
        <KpiCard
          label="Overrun, 7 days"
          value={bill.data ? formatMoney(bill.data.totals.penalty) : "—"}
          detail="Penalty on peaks above contract"
        />
      </section>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface shadow-card">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="text-[11px] uppercase tracking-[0.14em] text-mist">
            <tr>
              <th className="px-4 py-3 font-medium">Facility</th>
              <th className="px-4 py-3 font-medium">Contract used</th>
              <th className="px-4 py-3 font-medium">On-site cover</th>
              <th className="px-4 py-3 font-medium">Headroom</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((site) => (
              <tr key={site.code} className="border-t border-line">
                <td className="px-4 py-3">
                  <Link to={`/facilities/${site.code}`} className="font-display font-semibold hover:text-olive">
                    {site.name}
                  </Link>
                  <p className="text-xs text-mist">{site.facility_type}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="w-32">
                    <Meter utilization={site.utilization} warningRatio={site.warning_ratio} criticalRatio={site.critical_ratio} />
                  </div>
                  <p className="num mt-1 text-xs text-mist">{formatPercent(site.utilization)}</p>
                </td>
                <td className="num px-4 py-3">{formatPercent(coverRatio(site.solar_kw, site.load_kw))}</td>
                <td className="num px-4 py-3">{formatNumber(site.headroom_kw)} kW</td>
                <td className="px-4 py-3">
                  <StatusBadge status={site.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

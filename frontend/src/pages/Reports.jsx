import { api } from "../api";
import KpiCard from "../components/KpiCard";
import SectionHeader from "../components/SectionHeader";
import { ErrorState, LoadingState, StaleBanner } from "../components/ui";
import { formatDayTime, formatMoney, formatNumber, formatPercent } from "../format";
import { useDocumentTitle, usePoll } from "../hooks";
import { carbonTonnesFromSolar, seriesPeak } from "../metrics";

export default function Reports() {
  useDocumentTitle("Reports");
  const dash = usePoll(api.dashboard, 15000);
  const bill = usePoll(api.billing, 15000);
  const solar = usePoll(api.renewables, 15000);

  if ((dash.loading && !dash.data) || (bill.loading && !bill.data)) return <LoadingState />;
  if (!dash.data) return <ErrorState message={dash.error} onRetry={dash.reload} />;
  if (!bill.data) return <ErrorState message={bill.error} onRetry={bill.reload} />;

  const { kpis, portfolio, facilities } = dash.data;
  const peak = seriesPeak(portfolio.series);
  const carbon = carbonTonnesFromSolar(kpis.solar_kwh_24h);

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Reports"
        title="Operating summary"
        detail="A single reading of the live desk and the trailing cost window. Print this page to keep a copy."
        aside={
          <button type="button" onClick={() => window.print()} className="no-print rounded-md bg-ink px-3 py-2 text-sm font-medium text-ivory">
            Print
          </button>
        }
      />
      <StaleBanner message={dash.error || bill.error} />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Load, 24 h" value={formatNumber(kpis.load_kwh_24h)} unit="kWh" detail={`${formatNumber(kpis.live_load_kw)} kW now`} />
        <KpiCard label="Grid import, 24 h" value={formatNumber(kpis.grid_kwh_24h)} unit="kWh" detail={`Peak hour ${formatNumber(peak)} kW`} />
        <KpiCard label="Estimated bill" value={formatMoney(bill.data.totals.total)} detail={`Trailing ${bill.data.window_days} days`} />
        <KpiCard label="Carbon avoided" value={formatNumber(carbon, 1)} unit="t" detail="From metered solar" />
      </section>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface shadow-card">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-[11px] uppercase tracking-[0.14em] text-mist">
            <tr>
              <th className="px-4 py-3 font-medium">Facility</th>
              <th className="px-4 py-3 font-medium">Live grid</th>
              <th className="px-4 py-3 font-medium">7-day import</th>
              <th className="px-4 py-3 font-medium">Peak</th>
              <th className="px-4 py-3 font-medium">Estimate</th>
            </tr>
          </thead>
          <tbody>
            {bill.data.sites.map((site) => {
              const live = facilities.find((item) => item.code === site.code);
              return (
                <tr key={site.code} className="border-t border-line">
                  <td className="px-4 py-3">
                    <p className="font-display font-semibold">{site.name}</p>
                    <p className="text-xs text-mist">{site.location}</p>
                  </td>
                  <td className="num px-4 py-3">{live ? `${formatNumber(live.grid_kw)} kW` : "—"}</td>
                  <td className="num px-4 py-3">{formatNumber(site.grid_kwh)} kWh</td>
                  <td className="px-4 py-3">
                    <p className="num">{formatNumber(site.peak_kw)} kW</p>
                    <p className="text-xs text-mist">{formatDayTime(site.peak_at)}</p>
                  </td>
                  <td className="num px-4 py-3">{formatMoney(site.total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {solar.data && (
        <p className="text-sm text-mist">
          Installed solar is {formatNumber(solar.data.capacity_kw)} kW and covered {formatPercent(solar.data.offset_ratio)} of load over{" "}
          {solar.data.window_days} days, with {formatNumber(solar.data.export_kwh)} kWh exported.
        </p>
      )}
    </div>
  );
}

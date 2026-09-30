import { api } from "../api";
import EnergyConsumptionChart from "../components/EnergyConsumptionChart";
import KpiCard from "../components/KpiCard";
import SectionHeader from "../components/SectionHeader";
import { ErrorState, LoadingState, Panel, StaleBanner } from "../components/ui";
import { formatNumber, formatPercent } from "../format";
import { useDocumentTitle, usePoll } from "../hooks";

export default function Monitoring() {
  useDocumentTitle("Energy Monitoring");
  const { data, error, loading, reload } = usePoll(api.dashboard, 5000);

  if (loading && !data) return <LoadingState />;
  if (!data) return <ErrorState message={error} onRetry={reload} />;

  const { kpis, portfolio } = data;

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Energy monitoring"
        title="Consumption over time"
        detail="Total building load, the solar that offsets it, and what still comes from the utility."
      />
      <StaleBanner message={error} />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Load, 24 h" value={formatNumber(kpis.load_kwh_24h)} unit="kWh" detail={`${formatNumber(kpis.live_load_kw)} kW live`} />
        <KpiCard label="Solar, 24 h" value={formatNumber(kpis.solar_kwh_24h)} unit="kWh" detail={`${formatNumber(kpis.live_solar_kw)} kW live`} />
        <KpiCard label="Grid, 24 h" value={formatNumber(kpis.grid_kwh_24h)} unit="kWh" detail={`${formatNumber(kpis.live_grid_kw)} kW imported`} />
        <KpiCard label="Solar share of load" value={formatPercent(kpis.renewable_share_24h)} detail="Wind is not in this feed" />
      </section>
      <Panel>
        <EnergyConsumptionChart data={portfolio.series} limit={portfolio.limit_kw} warning={portfolio.warning_kw} />
      </Panel>
    </div>
  );
}

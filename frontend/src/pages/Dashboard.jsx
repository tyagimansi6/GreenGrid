import { Link } from "react-router-dom";
import { api } from "../api";
import EnergyConsumptionChart from "../components/EnergyConsumptionChart";
import EnergyFlow from "../components/EnergyFlow";
import FacilityPerformance from "../components/FacilityPerformance";
import KpiCard from "../components/KpiCard";
import RenewableMix from "../components/RenewableMix";
import SectionHeader from "../components/SectionHeader";
import { ErrorState, LoadingState, StaleBanner } from "../components/ui";
import UtilityBilling from "../components/UtilityBilling";
import { formatMoney, formatNumber, formatPercent } from "../format";
import { useDocumentTitle, usePoll } from "../hooks";
import { carbonTonnesFromSolar, seriesPeak } from "../metrics";

export default function Dashboard() {
  useDocumentTitle("Overview");
  const dash = usePoll(api.dashboard, 5000);
  const bill = usePoll(api.billing, 15000);

  if (dash.loading && !dash.data) return <LoadingState />;
  if (!dash.data) return <ErrorState message={dash.error} onRetry={dash.reload} />;

  const { kpis, portfolio, facilities, alerts } = dash.data;
  const peak = seriesPeak(portfolio.series, "grid_kw");
  const carbon = carbonTonnesFromSolar(kpis.solar_kwh_24h);

  return (
    <div className="space-y-8">
      <StaleBanner message={dash.error} />
      <SectionHeader
        kicker="Overview"
        title="Portfolio"
        detail="Live demand across the facilities, with on-site solar set against utility import."
        aside={
          alerts.length > 0 ? (
            <Link to="/alerts" className="text-sm font-medium text-olive">
              {alerts.length} site{alerts.length === 1 ? "" : "s"} need attention
            </Link>
          ) : null
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Total energy"
          value={formatNumber(kpis.live_load_kw)}
          unit="kW"
          detail={`${formatNumber(kpis.load_kwh_24h)} kWh over 24 hours`}
        />
        <KpiCard
          label="Renewable energy"
          value={formatNumber(kpis.live_solar_kw)}
          unit="kW"
          detail={`Solar live · ${formatPercent(kpis.renewable_share_24h)} of load · wind unmetered`}
        />
        <KpiCard
          label="Grid consumption"
          value={formatNumber(kpis.live_grid_kw)}
          unit="kW"
          detail={`${formatNumber(kpis.grid_kwh_24h)} kWh imported in 24 hours`}
        />
        <KpiCard
          label="Energy cost"
          value={bill.data ? formatMoney(bill.data.totals.total) : "—"}
          detail={bill.data ? `Trailing ${bill.data.window_days} days` : "Billing feed loading"}
        />
        <KpiCard
          label="Carbon saved"
          value={formatNumber(carbon, 1)}
          unit="t"
          detail="Estimated from solar, 0.386 kg CO₂ per kWh"
        />
      </section>

      <section className="grid items-start gap-4 xl:grid-cols-5">
        <div className="rounded-lg border border-line bg-surface p-5 shadow-card xl:col-span-3 md:p-6">
          <SectionHeader
            plain
            title="Energy consumption"
            detail="Building load, on-site solar, and utility import over the last 24 hours."
          />
          <div className="mt-4">
            <EnergyConsumptionChart data={portfolio.series} limit={portfolio.limit_kw} warning={portfolio.warning_kw} />
          </div>
        </div>
        <div className="rounded-lg border border-line bg-surface p-5 shadow-card xl:col-span-2 md:p-6">
          <SectionHeader plain title="Renewable energy mix" detail="Solar generation against grid import." />
          <div className="mt-2">
            <RenewableMix
              solarKwh={kpis.solar_kwh_24h}
              gridKwh={kpis.grid_kwh_24h}
              renewableShare={kpis.renewable_share_24h}
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-5 shadow-card md:p-6">
        <SectionHeader
          plain
          title="Live energy flow"
          detail="The same path the landscape takes: generation into the yard, then out to the facilities."
        />
        <div className="mt-4">
          <EnergyFlow
            solarKw={kpis.live_solar_kw}
            gridKw={kpis.live_grid_kw}
            loadKw={kpis.live_load_kw}
            facilities={kpis.facility_count}
          />
        </div>
      </section>

      <FacilityPerformance facilities={facilities} billingSites={bill.data?.sites} />
      <UtilityBilling billing={bill.data} peakKw={peak} error={bill.error} loading={bill.loading} />
    </div>
  );
}

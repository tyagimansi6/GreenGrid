import { api } from "../api";
import { DemandChart } from "../components/Charts";
import { ErrorState, LoadingState, PageHeader, Panel, StaleBanner } from "../components/ui";
import { formatNumber, formatPercent } from "../format";
import { useDocumentTitle, usePoll } from "../hooks";

export default function Renewables() {
  useDocumentTitle("Renewables");
  const { data, error, loading, updatedAt, reload } = usePoll(api.renewables, 15000);

  if (loading && !data) return <LoadingState />;
  if (!data) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <PageHeader
        eyebrow="Smart grid"
        title="Solar, on the customer side of the meter"
        lede="On-site generation covers part of the building load, so the utility sees a smaller demand. When solar exceeds the load, the extra is exported."
        updatedAt={updatedAt}
      />
      <StaleBanner message={error} />

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Solar capacity" value={`${formatNumber(data.capacity_kw)} kW`} detail="Installed across the portfolio" featured />
        <Stat label="Generated, 7 days" value={`${formatNumber(data.solar_kwh)} kWh`} detail="Behind the meter" />
        <Stat label="Load covered" value={formatPercent(data.offset_ratio)} detail="Solar kilowatt-hours ÷ building load" />
        <Stat label="Exported" value={`${formatNumber(data.export_kwh)} kWh`} detail={`${formatNumber(data.grid_kwh)} kWh still imported`} />
      </dl>

      <Panel className="mt-4">
        <h2 className="font-display text-lg font-semibold">Grid import and solar, last 48 hours</h2>
        <p className="mt-1 text-sm text-mist">Turn on building load to see how much of the site consumption never reaches the utility meter.</p>
        <div className="mt-4">
          <DemandChart data={data.series} />
        </div>
      </Panel>

      <Panel className="mt-4">
        <h2 className="font-display text-lg font-semibold">Sites</h2>
        <ul className="mt-4 divide-y divide-line">
          {data.sites.map((site) => (
            <li key={site.code} className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))] sm:items-center">
              <div>
                <p className="font-display font-semibold">{site.name}</p>
                <p className="text-xs text-mist">{site.facility_type}</p>
              </div>
              <Metric label="Capacity" value={`${formatNumber(site.solar_capacity_kw)} kW`} />
              <Metric label="Generated" value={`${formatNumber(site.solar_kwh)} kWh`} />
              <Metric label="Exported" value={`${formatNumber(site.export_kwh)} kWh`} />
              <Metric label="Of load" value={formatPercent(site.offset_ratio)} />
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function Stat({ label, value, detail, featured = false }) {
  return (
    <div className={`rounded-lg border border-line p-5 shadow-card ${featured ? "border-ink bg-ink text-ivory" : "bg-surface"}`}>
      <p className={`text-[11px] font-medium uppercase tracking-[0.14em] ${featured ? "text-ivory/70" : "text-mist"}`}>{label}</p>
      <p className="num mt-2 text-3xl font-semibold">{value}</p>
      <p className={`mt-1 text-xs ${featured ? "text-ivory/55" : "text-mist"}`}>{detail}</p>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <p>
      <span className="block text-[11px] uppercase tracking-[0.12em] text-mist">{label}</span>
      <span className="num text-sm font-medium">{value}</span>
    </p>
  );
}

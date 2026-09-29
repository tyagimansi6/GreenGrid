import { api } from "../api";
import { CostChart } from "../components/Charts";
import { ErrorState, LoadingState, PageHeader, Panel, StaleBanner, StatusBadge } from "../components/ui";
import { formatDayTime, formatMoney, formatNumber } from "../format";
import { useDocumentTitle, usePoll } from "../hooks";

export default function Billing() {
  useDocumentTitle("Billing");
  const { data, error, loading, updatedAt, reload } = usePoll(api.billing, 15000);

  if (loading && !data) return <LoadingState />;
  if (!data) return <ErrorState message={error} onRetry={reload} />;

  const { totals, sites, note } = data;

  return (
    <div>
      <PageHeader
        eyebrow="Billing"
        title="Where the bill comes from"
        lede="Three charges make up the estimate: energy imported from the grid, a demand charge on the week's peak, and a penalty when that peak breaks the contract."
        updatedAt={updatedAt}
      />
      <StaleBanner message={error} />

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Money label="Estimated total" value={totals.total} detail={`${formatNumber(totals.grid_kwh)} kWh imported`} featured />
        <Money label="Energy charge" value={totals.energy} detail="Grid kWh × tariff" />
        <Money label="Demand charge" value={totals.demand} detail="Peak kW × rate × 7/30" />
        <Money label="Overrun penalty" value={totals.penalty} detail="kW above the contract × penalty rate" hot={totals.penalty > 0} />
      </dl>

      <Panel className="mt-4">
        <h2 className="font-display text-lg font-semibold">Cost by site</h2>
        <p className="mt-1 text-sm text-mist">Green is energy, sage is demand, red is the overrun penalty.</p>
        <div className="mt-4">
          <CostChart data={sites} />
        </div>
        <details className="mt-2 text-sm text-mist">
          <summary className="cursor-pointer font-medium text-ink">How these charges are calculated</summary>
          <p className="mt-2 max-w-3xl leading-6">{note}</p>
        </details>
      </Panel>

      <Panel className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-[11px] uppercase tracking-[0.14em] text-mist">
            <tr>
              <th className="px-2 py-2 font-semibold">Site</th>
              <th className="px-2 py-2 font-semibold">Peak</th>
              <th className="px-2 py-2 font-semibold">Import</th>
              <th className="px-2 py-2 font-semibold">Energy</th>
              <th className="px-2 py-2 font-semibold">Demand</th>
              <th className="px-2 py-2 font-semibold">Penalty</th>
              <th className="px-2 py-2 font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {sites.map((site) => (
              <tr key={site.code} className="border-t border-line">
                <td className="px-2 py-3">
                  <p className="font-display font-semibold">{site.name}</p>
                  <p className="text-xs text-mist">{site.location}</p>
                </td>
                <td className="px-2 py-3">
                  <StatusBadge status={site.peak_status} />
                  <p className="num mt-1 text-xs text-mist">
                    {formatNumber(site.peak_kw)} / {formatNumber(site.limit_kw)} kW
                  </p>
                  <p className="text-xs text-mist">{formatDayTime(site.peak_at)}</p>
                </td>
                <td className="num px-2 py-3">{formatNumber(site.grid_kwh)} kWh</td>
                <td className="num px-2 py-3">{formatMoney(site.energy_charge)}</td>
                <td className="num px-2 py-3">{formatMoney(site.demand_charge)}</td>
                <td className={`num px-2 py-3 ${site.penalty > 0 ? "font-semibold text-crit" : ""}`}>{formatMoney(site.penalty)}</td>
                <td className="num px-2 py-3 font-semibold">{formatMoney(site.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

function Money({ label, value, detail, featured = false, hot = false }) {
  return (
    <div className={`rounded-[24px] p-5 shadow-card ${featured ? "bg-ink text-white" : "bg-white"}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${featured ? "text-white/50" : "text-mist"}`}>{label}</p>
      <p className={`num mt-2 text-3xl font-semibold ${hot ? "text-crit" : ""}`}>{formatMoney(value)}</p>
      <p className={`mt-1 text-xs ${featured ? "text-white/55" : "text-mist"}`}>{detail}</p>
    </div>
  );
}

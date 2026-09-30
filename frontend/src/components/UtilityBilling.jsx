import { CostChart } from "./Charts";
import SectionHeader from "./SectionHeader";
import { formatMoney, formatNumber } from "../format";

function Stat({ label, value, detail }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-mist">{label}</p>
      <p className="num mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs leading-5 text-mist">{detail}</p>
    </div>
  );
}

export default function UtilityBilling({ billing, peakKw, error, loading }) {
  const totals = billing?.totals;

  return (
    <div>
      <SectionHeader
        kicker="Cost"
        title="Utility and billing"
        detail="Energy, demand, and overrun penalty for the trailing 7 days. A prior bill is not stored in this feed."
      />
      {loading && !billing ? (
        <p className="mt-4 text-sm text-mist">Loading the billing feed…</p>
      ) : !totals ? (
        <p className="mt-4 text-sm text-mist" role="status">
          Billing feed unavailable. {error}
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-4 rounded-lg border border-line bg-surface p-5 shadow-card sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Current estimate" value={formatMoney(totals.total)} detail={`Trailing ${billing.window_days} days`} />
            <Stat label="Previous bill" value="—" detail="No prior period in the feed" />
            <Stat label="Consumption" value={`${formatNumber(totals.grid_kwh)} kWh`} detail="Grid import in the window" />
            <Stat label="Peak demand" value={`${formatNumber(peakKw)} kW`} detail="Highest portfolio hour, last 24 h" />
          </div>
          <div className="mt-4 rounded-lg border border-line bg-surface p-5 shadow-card">
            <h3 className="font-display text-base font-semibold">Cost trend by site</h3>
            <p className="mt-1 text-sm text-mist">Slate is energy, sage is demand, clay is the overrun penalty.</p>
            <div className="mt-4">
              <CostChart data={billing.sites} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

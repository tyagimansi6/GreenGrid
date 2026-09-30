import { Link } from "react-router-dom";
import { formatNumber, formatPercent } from "../format";
import { coverRatio } from "../metrics";
import StatusBadge from "./StatusBadge";
import SectionHeader from "./SectionHeader";

export default function FacilityPerformance({ facilities = [], billingSites = [] }) {
  const peaks = new Map((billingSites || []).map((site) => [site.code, site]));

  return (
    <div>
      <SectionHeader
        kicker="Sites"
        title="Facility performance"
        detail="Live load, the share covered by on-site solar, and the trailing peak where the billing feed has one."
      />
      <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-surface shadow-card">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-[11px] uppercase tracking-[0.14em] text-mist">
            <tr>
              <th className="px-4 py-3 font-medium">Facility</th>
              <th className="px-4 py-3 font-medium">Consumption</th>
              <th className="px-4 py-3 font-medium">Renewable</th>
              <th className="px-4 py-3 font-medium">Peak demand</th>
              <th className="px-4 py-3 font-medium">Efficiency</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {facilities.map((site) => {
              const bill = peaks.get(site.code);
              const cover = coverRatio(site.solar_kw, site.load_kw);
              return (
                <tr key={site.code} className="border-t border-line">
                  <td className="px-4 py-3">
                    <Link to={`/facilities/${site.code}`} className="font-display font-semibold hover:text-olive">
                      {site.name}
                    </Link>
                    <p className="text-xs text-mist">
                      {site.facility_type} · {site.location}
                    </p>
                  </td>
                  <td className="num px-4 py-3">
                    {formatNumber(site.load_kw)} kW
                    <p className="text-xs text-mist">{formatNumber(site.grid_kw)} kW from the grid</p>
                  </td>
                  <td className="num px-4 py-3">
                    {formatPercent(cover)}
                    <p className="text-xs text-mist">{formatNumber(site.solar_kw)} kW solar</p>
                  </td>
                  <td className="num px-4 py-3">
                    {bill ? `${formatNumber(bill.peak_kw)} kW` : "—"}
                    <p className="text-xs text-mist">{bill ? "Trailing 7-day peak" : "Not in this feed"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-1.5 w-24 rounded-full bg-ink/10">
                      <div className="h-1.5 rounded-full bg-slate" style={{ width: `${Math.min(cover, 1) * 100}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-mist">Solar ÷ load</p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={site.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

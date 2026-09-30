import { Link } from "react-router-dom";
import { api } from "../api";
import SectionHeader from "../components/SectionHeader";
import { ErrorState, LoadingState, Panel, StaleBanner } from "../components/ui";
import { useDocumentTitle, usePoll } from "../hooks";

export default function Settings() {
  useDocumentTitle("Settings");
  const { data, error, loading, reload } = usePoll(api.facilities, 15000);

  if (loading && !data) return <LoadingState />;
  if (!data) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Settings"
        title="How this desk is metered"
        detail="Contracts, tariffs, and alert lines are stored on each facility. There is no separate account service on this desk."
      />
      <StaleBanner message={error} />
      <Panel>
        <h2 className="font-display text-lg font-semibold">Meter model</h2>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-mist">
          <li>Demand limits and live alerts are in kilowatts.</li>
          <li>Energy charges settle in kilowatt-hours of grid import.</li>
          <li>On-site solar is metered behind the facility. Wind is visible in the landscape and is not in the feed.</li>
          <li>The overview refreshes about every 5 seconds. Billing and renewables refresh more slowly.</li>
        </ul>
      </Panel>
      <Panel>
        <h2 className="font-display text-lg font-semibold">Facility contracts</h2>
        <p className="mt-1 text-sm text-mist">Open a site to edit its limit, warning line, and tariff.</p>
        <ul className="mt-4 divide-y divide-line">
          {data.facilities.map((site) => (
            <li key={site.code} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-display font-semibold">{site.name}</p>
                <p className="text-xs text-mist">
                  {site.facility_type} · {site.location}
                </p>
              </div>
              <Link to={`/facilities/${site.code}`} className="text-sm font-medium text-olive">
                Edit contract
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

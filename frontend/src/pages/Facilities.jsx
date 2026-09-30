import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { api } from "../api";
import { ErrorState, LoadingState, Meter, PageHeader, Panel, StaleBanner, StatusBadge } from "../components/ui";
import { formatNumber, formatPercent, headroomText } from "../format";
import { useDocumentTitle, usePoll } from "../hooks";

const STATUS_RANK = { critical: 0, warning: 1, normal: 2 };
const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "critical", label: "Critical" },
  { id: "warning", label: "Warning" },
  { id: "normal", label: "Normal" },
];

function compare(a, b, key) {
  if (key === "status") return STATUS_RANK[a.status] - STATUS_RANK[b.status];
  if (key === "name") return a.name.localeCompare(b.name);
  return a[key] - b[key];
}

export default function Facilities() {
  useDocumentTitle("Facilities");
  const { data, error, loading, updatedAt, reload } = usePoll(api.facilities, 5000);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [kind, setKind] = useState("all");
  const [sort, setSort] = useState({ key: "status", dir: "asc" });

  const facilities = data?.facilities || [];
  const kinds = useMemo(
    () => ["all", ...Array.from(new Set(facilities.map((site) => site.facility_type)))],
    [facilities],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = facilities.filter((site) => {
      const matchesQuery =
        !needle ||
        site.name.toLowerCase().includes(needle) ||
        site.code.toLowerCase().includes(needle) ||
        site.location.toLowerCase().includes(needle);
      const matchesStatus = status === "all" || site.status === status;
      const matchesKind = kind === "all" || site.facility_type === kind;
      return matchesQuery && matchesStatus && matchesKind;
    });
    const direction = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const primary = compare(a, b, sort.key);
      if (primary !== 0) return primary * direction;
      return b.utilization - a.utilization;
    });
  }, [facilities, query, status, kind, sort]);

  function toggleSort(key) {
    setSort((current) =>
      current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  if (loading && !data) return <LoadingState />;
  if (!data) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <PageHeader
        eyebrow="Facilities"
        title="All sites"
        lede="Search the portfolio and sort by how close each meter is to its utility limit."
        updatedAt={updatedAt}
      />
      <StaleBanner message={error} />
      <Panel>
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-[220px] flex-1">
            <span className="sr-only">Search facilities</span>
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mist" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, city, or code"
              className="w-full rounded-md border border-line bg-paper py-2 pl-9 pr-3 text-sm outline-none focus:border-bronze"
            />
          </label>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by alert">
            {STATUS_FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={status === item.id}
                onClick={() => setStatus(item.id)}
                className={`rounded-md px-3 py-1.5 text-sm ${status === item.id ? "bg-ink text-ivory" : "bg-paper text-ink"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1" role="group" aria-label="Filter by type">
          {kinds.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={kind === item}
              onClick={() => setKind(item)}
              className={`rounded-md px-3 py-1 text-xs font-medium ${kind === item ? "bg-ink text-ivory" : "text-mist"}`}
            >
              {item === "all" ? "Every type" : item}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <p className="mt-8 text-sm text-mist">No sites match that filter.</p>
        ) : (
          <>
            <div className="mt-5 hidden md:block">
              <table className="w-full text-left text-sm">
                <thead className="text-[11px] uppercase tracking-[0.14em] text-mist">
                  <tr>
                    <SortHead label="Site" sortKey="name" sort={sort} onSort={toggleSort} />
                    <th className="px-2 py-2 font-semibold">Level</th>
                    <SortHead label="Metered" sortKey="grid_kw" sort={sort} onSort={toggleSort} />
                    <SortHead label="Contract" sortKey="contracted_limit_kw" sort={sort} onSort={toggleSort} />
                    <SortHead label="Used" sortKey="utilization" sort={sort} onSort={toggleSort} />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((site) => (
                    <tr key={site.code} className="border-t border-line">
                      <td className="px-2 py-3">
                        <Link to={`/facilities/${site.code}`} className="font-display font-semibold hover:text-moss">
                          {site.name}
                        </Link>
                        <p className="text-xs text-mist">
                          {site.facility_type} · {site.location}
                        </p>
                      </td>
                      <td className="px-2 py-3">
                        <StatusBadge status={site.status} />
                      </td>
                      <td className="num px-2 py-3">{formatNumber(site.grid_kw)} kW</td>
                      <td className="num px-2 py-3">{formatNumber(site.contracted_limit_kw)} kW</td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-28">
                            <Meter utilization={site.utilization} warningRatio={site.warning_ratio} criticalRatio={site.critical_ratio} />
                          </div>
                          <span className="num text-mist">{formatPercent(site.utilization)}</span>
                        </div>
                        <p className="mt-1 text-xs text-mist">{headroomText(site.headroom_kw)}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="mt-5 space-y-3 md:hidden">
              {visible.map((site) => (
                <li key={site.code}>
                  <Link to={`/facilities/${site.code}`} className="block rounded-lg border border-line bg-paper p-4">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-display font-semibold">{site.name}</span>
                      <StatusBadge status={site.status} />
                    </span>
                    <span className="mt-1 block text-sm text-mist">{site.location}</span>
                    <span className="num mt-3 block text-2xl font-semibold">{formatNumber(site.grid_kw)} kW</span>
                    <span className="mt-2 block">
                      <Meter utilization={site.utilization} warningRatio={site.warning_ratio} criticalRatio={site.critical_ratio} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    </div>
  );
}

function SortHead({ label, sortKey, sort, onSort }) {
  const active = sort.key === sortKey;
  const arrow = !active ? "" : sort.dir === "asc" ? " ↑" : " ↓";
  return (
    <th className="px-2 py-2 font-semibold">
      <button type="button" onClick={() => onSort(sortKey)} className="uppercase tracking-[0.14em]">
        {label}
        {arrow}
        {active && <span className="sr-only">{sort.dir === "asc" ? ", sorted ascending" : ", sorted descending"}</span>}
      </button>
    </th>
  );
}

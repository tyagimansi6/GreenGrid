import { memo, useEffect, useRef, useState } from "react";
import { Bell, CalendarRange, Menu } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import { usePoll } from "../hooks";

const RANGE = {
  "/overview": "Last 24 hours",
  "/monitoring": "Last 24 hours",
  "/grid": "Last 24 hours",
  "/analytics": "24 h demand · 7-day cost",
  "/reports": "24 h demand · 7-day cost",
  "/renewables": "Last 48 hours",
  "/billing": "Trailing 7 days",
  "/facilities": "Live",
  "/settings": "Portfolio",
  "/alerts": "Live",
};

function Topbar({ onMenu }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { data } = usePoll(api.alerts, 15000);
  const { data: facilityData } = usePoll(api.facilities, 15000);
  const [notesOpen, setNotesOpen] = useState(false);
  const notesRef = useRef(null);

  const alerts = data?.alerts || [];
  const facilities = facilityData?.facilities || [];
  const facilityCode = location.pathname.match(/^\/facilities\/([^/]+)/)?.[1] || "";
  const range =
    RANGE[location.pathname] ||
    (facilityCode ? "Live site" : "Live");

  useEffect(() => {
    setNotesOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!notesOpen) return undefined;
    function onPointer(event) {
      if (!notesRef.current?.contains(event.target)) setNotesOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [notesOpen]);

  return (
    <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-white/20 bg-[#e6e3da]/60 px-4 py-3 backdrop-blur-md md:px-8">
      <button
        type="button"
        className="rounded-md border border-line bg-surface p-2 text-ink md:hidden"
        onClick={onMenu}
        aria-label="Open navigation"
      >
        <Menu size={18} />
      </button>

      <label className="min-w-0 flex-1">
        <span className="sr-only">Facility</span>
        <select
          className="w-full max-w-xs truncate rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none"
          value={facilityCode}
          onChange={(event) => {
            const next = event.target.value;
            navigate(next ? `/facilities/${next}` : "/facilities");
          }}
        >
          <option value="">GreenGrid Portfolio</option>
          {facilities.map((site) => (
            <option key={site.code} value={site.code}>
              {site.name}
            </option>
          ))}
        </select>
      </label>

      <p className="hidden items-center gap-2 text-sm text-mist sm:flex">
        <CalendarRange size={15} aria-hidden="true" />
        <span>{range}</span>
      </p>

      <div className="relative" ref={notesRef}>
        <button
          type="button"
          className="relative rounded-md border border-line bg-surface p-2 text-ink"
          aria-expanded={notesOpen}
          aria-label={alerts.length ? `${alerts.length} alerts` : "Notifications"}
          onClick={() => setNotesOpen((open) => !open)}
        >
          <Bell size={16} />
          {alerts.length > 0 && (
            <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-crit px-1 text-[10px] font-medium text-ivory">
              {alerts.length}
            </span>
          )}
        </button>
        {notesOpen && (
          <div className="absolute right-0 z-30 mt-2 w-72 rounded-lg border border-line bg-surface p-3 shadow-card">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-mist">Notifications</p>
            {alerts.length === 0 ? (
              <p className="mt-2 text-sm text-mist">Every site is inside its warning line.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {alerts.slice(0, 5).map((site) => (
                  <li key={site.code}>
                    <Link
                      to={`/facilities/${site.code}`}
                      className="block rounded-md px-2 py-2 text-sm hover:bg-paper"
                      onClick={() => setNotesOpen(false)}
                    >
                      <span className="font-medium">{site.name}</span>
                      <span className="mt-0.5 block text-xs capitalize text-mist">{site.status}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/alerts" className="mt-2 inline-block text-sm font-medium text-olive" onClick={() => setNotesOpen(false)}>
              Open alerts
            </Link>
          </div>
        )}
      </div>

      <div className="hidden items-center gap-2 sm:flex" aria-label="Signed-in desk">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-ink text-xs font-medium text-ivory">GG</span>
        <span className="text-sm leading-tight">
          <span className="block font-medium">Operations</span>
          <span className="block text-xs text-mist">Portfolio desk</span>
        </span>
      </div>
    </header>
  );
}

export default memo(Topbar);

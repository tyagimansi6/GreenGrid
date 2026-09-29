import { Bell, Building2, LayoutDashboard, Receipt, Sun } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

const LINKS = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/facilities", label: "Facilities", icon: Building2 },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/billing", label: "Billing", icon: Receipt },
  { to: "/renewables", label: "Renewables", icon: Sun },
];

function Mark() {
  return (
    <span className="grid grid-cols-2 gap-0.5" aria-hidden="true">
      <i className="h-2.5 w-2.5 rounded-[2px] bg-lime" />
      <i className="h-2.5 w-2.5 rounded-[2px] bg-white/25" />
      <i className="h-2.5 w-2.5 rounded-[2px] bg-white/25" />
      <i className="h-2.5 w-2.5 rounded-[2px] bg-lime" />
    </span>
  );
}

export default function Layout() {
  return (
    <div className="min-h-screen bg-ink md:grid md:grid-cols-[252px_minmax(0,1fr)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-lime focus:px-3 focus:py-2">
        Skip to content
      </a>
      <aside className="md:sticky md:top-0 md:flex md:h-screen md:flex-col md:px-4 md:py-6">
        <div className="flex items-center gap-3 px-4 py-4 md:px-2 md:py-0">
          <Mark />
          <div>
            <p className="font-display text-lg font-extrabold leading-none tracking-tight text-white">GreenGrid</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/45">Energy EMIS</p>
          </div>
        </div>
        <nav className="grid grid-cols-2 gap-1 px-3 pb-3 sm:grid-cols-3 md:mt-8 md:flex md:flex-col md:px-0 md:pb-0" aria-label="Primary">
          {LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    isActive ? "bg-lime text-ink" : "text-white/70 hover:bg-white/5 hover:text-white"
                  }`
                }
              >
                <Icon size={16} aria-hidden="true" />
                {link.label}
              </NavLink>
            );
          })}
        </nav>
        <p className="mt-auto hidden px-3 text-xs leading-5 text-white/40 md:block">
          Contract limits are watched in kW. Energy charges settle in kWh.
        </p>
      </aside>
      <div id="main" className="grid-paper min-w-0 overflow-x-clip rounded-t-[28px] md:rounded-none">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

import { memo } from "react";
import {
  Activity,
  Bell,
  Building2,
  Cable,
  FileText,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Settings,
  Sun,
  LineChart,
  X,
} from "lucide-react";
import { NavLink } from "react-router-dom";

const PRIMARY = [
  { to: "/overview", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/monitoring", label: "Energy Monitoring", icon: Activity },
  { to: "/facilities", label: "Facilities", icon: Building2 },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/renewables", label: "Renewables", icon: Sun },
  { to: "/billing", label: "Utility & Billing", icon: Receipt },
  { to: "/analytics", label: "Analytics", icon: LineChart },
  { to: "/grid", label: "Grid", icon: Cable },
  { to: "/reports", label: "Reports", icon: FileText },
];

function Mark() {
  return (
    <span className="grid shrink-0 grid-cols-2 gap-0.5" aria-hidden="true">
      <i className="h-2 w-2 bg-ivory" />
      <i className="h-2 w-2 bg-slate" />
      <i className="h-2 w-2 bg-sage" />
      <i className="h-2 w-2 bg-ivory/35" />
    </span>
  );
}

function NavItem({ to, label, icon: Icon, end, collapsed, onClose, className = "" }) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      onClick={onClose}
      className={({ isActive }) =>
        `nav-link flex items-center gap-2.5 rounded-md px-3 py-2 text-sm ${className} ${
          isActive ? "bg-ivory font-medium text-ink" : "text-ivory/70 hover:bg-white/5 hover:text-ivory"
        }`
      }
    >
      <Icon size={16} className="nav-icon shrink-0" aria-hidden="true" />
      <span className="nav-label">{label}</span>
    </NavLink>
  );
}

function Sidebar({ open, collapsed, onClose, onToggle }) {
  return (
    <>
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-ink/50 md:hidden"
          aria-label="Close navigation"
          onClick={onClose}
        />
      )}
      <aside
        className={`app-nav no-print fixed inset-y-0 left-0 z-40 flex h-screen w-[248px] flex-col overflow-hidden bg-ink/80 text-ivory backdrop-blur-md md:sticky md:top-0 md:shrink-0 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="nav-brand flex items-center justify-between gap-2 px-5 py-6">
          <NavLink to="/" className="nav-brand-link flex min-w-0 items-center gap-3" onClick={onClose}>
            <Mark />
            <span className="nav-label">
              <span className="block font-display text-lg font-semibold leading-none tracking-tight">GreenGrid</span>
              <span className="mt-1 block text-[11px] uppercase tracking-[0.16em] text-ivory/45">Energy EMIS</span>
            </span>
          </NavLink>
          <button type="button" className="shrink-0 text-ivory/70 md:hidden" onClick={onClose} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3" aria-label="Primary">
          {PRIMARY.map((link) => (
            <NavItem key={link.to} {...link} collapsed={collapsed} onClose={onClose} />
          ))}
          <NavItem to="/settings" label="Settings" icon={Settings} collapsed={collapsed} onClose={onClose} className="mt-auto" />
        </nav>

        <button
          type="button"
          className="nav-link mx-3 mb-3 hidden items-center gap-2.5 rounded-md px-3 py-2 text-sm text-ivory/70 hover:bg-white/5 hover:text-ivory md:flex"
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          onClick={onToggle}
        >
          {collapsed ? <PanelLeftOpen size={16} className="nav-icon shrink-0" /> : <PanelLeftClose size={16} className="nav-icon shrink-0" />}
          <span className="nav-label">{collapsed ? "Expand" : "Collapse"}</span>
        </button>

        <p className="nav-footnote px-6 pb-5 text-xs leading-5 text-ivory/40">Demand is watched in kW. Energy settles in kWh.</p>
      </aside>
    </>
  );
}

export default memo(Sidebar);

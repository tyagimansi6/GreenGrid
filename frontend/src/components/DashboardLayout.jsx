import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

const STORAGE_KEY = "greengrid-nav-collapsed";

function readCollapsed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function MainOutlet() {
  const location = useLocation();
  const seen = useRef(false);
  const animate = seen.current;

  useEffect(() => {
    seen.current = true;
  }, []);

  return (
    <div key={location.pathname} className={animate ? "page-swap" : undefined}>
      <Outlet />
    </div>
  );
}

export default function DashboardLayout() {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const close = useCallback(() => setOpen(false), []);
  const openMenu = useCallback(() => setOpen(true), []);
  const toggleCollapsed = useCallback(() => {
    setCollapsed((value) => {
      const next = !value;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* Private browsing can block storage; the toggle still applies. */
      }
      return next;
    });
  }, []);

  return (
    <div className="relative min-h-screen">
      <div className={`app-shell relative z-10 min-h-screen md:flex ${collapsed ? "is-collapsed" : ""}`}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-ivory focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <Sidebar open={open} collapsed={collapsed} onClose={close} onToggle={toggleCollapsed} />
        <div className="min-w-0 flex-1">
          <Topbar onMenu={openMenu} />
          <main id="main" className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
            <MainOutlet />
          </main>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import CinematicIntro from "./components/CinematicIntro";
import DashboardLayout from "./components/DashboardLayout";
import EnergyAssistant from "./components/EnergyAssistant";
import VideoHero from "./components/VideoHero";
import Alerts from "./pages/Alerts";
import Analytics from "./pages/Analytics";
import Billing from "./pages/Billing";
import Dashboard from "./pages/Dashboard";
import Facilities from "./pages/Facilities";
import FacilityDetail from "./pages/FacilityDetail";
import Grid from "./pages/Grid";
import Monitoring from "./pages/Monitoring";
import Renewables from "./pages/Renewables";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";

function FacilityRoute() {
  const { code } = useParams();
  return <FacilityDetail key={code} />;
}

function Missing() {
  return (
    <div className="rounded-lg border border-line bg-surface p-8 shadow-card">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-mist">404</p>
      <h1 className="mt-2 font-display text-3xl font-semibold">That page is not on the grid.</h1>
      <a href="/overview" className="mt-4 inline-block text-sm font-medium text-olive">
        Back to overview
      </a>
    </div>
  );
}

function DashboardRoutes() {
  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route path="overview" element={<Dashboard />} />
        <Route path="monitoring" element={<Monitoring />} />
        <Route path="facilities" element={<Facilities />} />
        <Route path="facilities/:code" element={<FacilityRoute />} />
        <Route path="renewables" element={<Renewables />} />
        <Route path="billing" element={<Billing />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="grid" element={<Grid />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="home" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Missing />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const motionRef = useRef(null);
  const leaveTimer = useRef(0);
  const [intro, setIntro] = useState(() => location.pathname === "/");
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (location.pathname === "/") {
      window.clearTimeout(leaveTimer.current);
      setIntro(true);
      setLeaving(false);
    }
  }, [location.pathname]);

  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);

  function enter() {
    if (leaving) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setLeaving(true);
    navigate("/overview");
    window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => {
      setIntro(false);
      setLeaving(false);
    }, reduce ? 220 : 900);
  }

  const showDashboard = location.pathname !== "/";

  return (
    <>
      <VideoHero motionRef={motionRef} />
      {showDashboard && (
        <div className={leaving ? "dashboard-reveal" : undefined}>
          <DashboardRoutes />
        </div>
      )}
      {intro && <CinematicIntro leaving={leaving} onEnter={enter} motionRef={motionRef} />}
      <EnergyAssistant />
    </>
  );
}

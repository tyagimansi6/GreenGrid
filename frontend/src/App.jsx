import { Navigate, Route, Routes, useParams } from "react-router-dom";
import Layout from "./components/Layout";
import Alerts from "./pages/Alerts";
import Billing from "./pages/Billing";
import Dashboard from "./pages/Dashboard";
import Facilities from "./pages/Facilities";
import FacilityDetail from "./pages/FacilityDetail";
import Renewables from "./pages/Renewables";

function FacilityRoute() {
  const { code } = useParams();
  return <FacilityDetail key={code} />;
}

function Missing() {
  return (
    <div className="rounded-[28px] bg-white p-8 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">404</p>
      <h1 className="mt-2 font-display font-bold text-4xl">That page is not on the grid.</h1>
      <a href="/" className="mt-4 inline-block text-sm font-semibold text-moss">
        Back to overview
      </a>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="facilities" element={<Facilities />} />
        <Route path="facilities/:code" element={<FacilityRoute />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="billing" element={<Billing />} />
        <Route path="renewables" element={<Renewables />} />
        <Route path="home" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Missing />} />
      </Route>
    </Routes>
  );
}

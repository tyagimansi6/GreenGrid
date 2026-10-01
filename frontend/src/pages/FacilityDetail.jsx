import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { DemandChart } from "../components/Charts";
import Gauge from "../components/Gauge";
import TrendChart from "../components/TrendChart";
import { theme } from "../theme";
import { ErrorState, Field, LoadingState, PageHeader, Panel, StaleBanner, StatusBadge, TextInput } from "../components/ui";
import { formatDayTime, formatMoney, formatNumber, formatTime, headroomText, joinForecast } from "../format";
import { useDocumentTitle, usePoll } from "../hooks";

const FORECAST_SERIES = [
  { key: "demand_kw", name: "Forecast demand", color: theme.sage, width: 2.2, dots: true },
];

const MODEL_FACILITY_IDS = {
  HARBOR: 1,
  NORDC: 2,
  CIVIC: 3,
  LAKES: 4,
  MERID: 5,
  RIVER: 6,
};

function ModelForecastCurve({ code, gridKw, solarKw }) {
  const facilityId = MODEL_FACILITY_IDS[String(code || "").toUpperCase()];
  const load = useCallback(() => {
    if (!facilityId || gridKw == null) return Promise.resolve(null);
    const now = new Date();
    return api.forecast(facilityId, {
      temperature_c: 22.5,
      humidity_pct: 55,
      wind_speed_ms: 3.2,
      previous_hour_demand_kw: Number(gridKw),
      solar_generation_kw: Number(solarKw) || 0,
      hour: now.getHours() + now.getMinutes() / 60,
      day_of_week: (now.getDay() + 6) % 7,
      month: now.getMonth() + 1,
    });
  }, [facilityId, gridKw, solarKw]);
  const { data, error, loading } = usePoll(load, 15000);
  const points = useMemo(
    () =>
      (data?.forecast || []).map((point) => ({
        label: `+${point.hour_ahead}h`,
        demand_kw: point.demand_kw,
      })),
    [data],
  );
  const peak = useMemo(() => points.reduce((max, point) => Math.max(max, point.demand_kw || 0), 1), [points]);
  const ceiling = useMemo(() => Math.ceil(peak * 1.08), [peak]);

  return (
    <Panel className="mt-4">
      <div data-testid="ml-forecast-curve">
        <h2 className="font-display text-lg font-semibold">Saved-model forecast</h2>
        <p className="mt-1 text-sm text-mist">
          {data
            ? `${data.model} · facility ${data.facility_id} · six hours from the live meter.`
            : "Six-hour curve from the Django forecast endpoint."}
        </p>
        {error && <p className="mt-3 text-sm text-crit">{error}</p>}
        {loading && !data && <p className="mt-4 text-sm text-mist">Requesting the live forecast…</p>}
        {points.length > 0 && (
          <div className="mt-4">
            <TrendChart data={points} max={ceiling} height={240} series={FORECAST_SERIES} />
          </div>
        )}
      </div>
    </Panel>
  );
}

const TONE = {
  critical: "border-crit/30 bg-crit/5",
  warning: "border-honey/30 bg-honey/10",
  info: "border-moss/20 bg-moss/5",
};

export default function FacilityDetail() {
  const { code } = useParams();
  const load = useCallback(() => api.facility(code), [code]);
  const { data, error, loading, updatedAt, reload } = usePoll(load, 5000);
  const [form, setForm] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const hydrated = useRef("");

  useDocumentTitle(data?.facility?.name || "Facility");

  useEffect(() => {
    if (!data?.facility || data.facility.code !== code || hydrated.current === code) return;
    const facility = data.facility;
    hydrated.current = code;
    setForm({
      contracted_limit_kw: facility.contracted_limit_kw,
      warning_pct: Math.round(facility.warning_ratio * 100),
      critical_pct: Math.round(facility.critical_ratio * 100),
      rate_per_kwh: facility.rate_per_kwh,
      demand_rate_per_kw: facility.demand_rate_per_kw,
      penalty_per_kw: facility.penalty_per_kw,
    });
    setSaved(false);
    setSaveError("");
  }, [data, code]);

  const historySeries = useMemo(
    () => (data ? joinForecast(data.history, data.forecast) : []),
    [data],
  );

  if (loading && !data) return <LoadingState />;
  if (!data) return <ErrorState message={error} onRetry={reload} />;

  const { facility, current, billing } = data;
  const limitPreview = Number(form?.contracted_limit_kw) || 0;
  const warningPreview = (limitPreview * (Number(form?.warning_pct) || 0)) / 100;
  const criticalPreview = (limitPreview * (Number(form?.critical_pct) || 0)) / 100;

  function update(field, value) {
    setSaved(false);
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    setSaveError("");
    setSaved(false);
    const limit = Number(form.contracted_limit_kw);
    const warning = Number(form.warning_pct) / 100;
    const critical = Number(form.critical_pct) / 100;
    if (!(limit > 0) || !(warning > 0 && warning < critical && critical <= 1)) {
      setSaveError("Set a positive limit. Warning must be above 0, below critical, and critical must be at most 100.");
      return;
    }
    setSaving(true);
    try {
      await api.updateFacility(code, {
        contracted_limit_kw: limit,
        warning_ratio: warning,
        critical_ratio: critical,
        rate_per_kwh: Number(form.rate_per_kwh),
        demand_rate_per_kw: Number(form.demand_rate_per_kw),
        penalty_per_kw: Number(form.penalty_per_kw),
      });
      setSaved(true);
      await reload();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Link to="/facilities" className="inline-flex rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-medium text-olive">
        All facilities
      </Link>
      <div className="mt-3">
        <PageHeader
          eyebrow={`${facility.facility_type} · ${facility.location}`}
          title={facility.name}
          lede={current.status === "critical" ? current && data.facility && "This meter needs action before the utility penalty settles in." : "Live metered demand against this site's contract."}
          updatedAt={updatedAt}
        />
      </div>
      <StaleBanner message={error} />

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Panel>
          <div className="flex justify-center">
            <Gauge
              utilization={current.utilization}
              warningRatio={facility.warning_ratio}
              criticalRatio={facility.critical_ratio}
              status={current.status}
            />
          </div>
          <div className="mt-2 flex justify-center">
            <StatusBadge status={current.status} />
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Metered grid" value={`${formatNumber(current.grid_kw)} kW`} />
            <Row label="Building load" value={`${formatNumber(current.load_kw)} kW`} />
            <Row label="Solar now" value={`${formatNumber(current.solar_kw)} kW`} />
            <Row label="Headroom" value={headroomText(current.headroom_kw)} />
          </dl>
        </Panel>
        <Panel>
          <h2 className="font-display text-lg font-semibold">What to do</h2>
          {data.recommendations.length === 0 ? (
            <p className="mt-4 text-sm leading-6 text-mist">This site is inside its plan. No load shed is called for right now.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.recommendations.map((item) => (
                <li key={item.title} className={`rounded-2xl border px-4 py-3 ${TONE[item.tone] || TONE.info}`}>
                  <p className="font-display font-semibold">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-ink/80">{item.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel className="mt-4">
        <h2 className="font-display text-lg font-semibold">Demand, last 48 hours</h2>
        <p className="mt-1 text-sm text-mist">{data.forecast_note} The dashed line is a regression on the hour of day and the previous hour.</p>
        <div className="mt-4">
          <DemandChart data={historySeries} limit={current.limit_kw} warning={current.warning_kw} showForecast />
        </div>
      </Panel>

      <Panel className="mt-4">
        <h2 className="font-display text-lg font-semibold">Next 6 hours</h2>
        <ol className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {data.forecast.map((point) => (
              <li key={point.t} className="min-w-[112px] rounded-md border border-line bg-paper px-3 py-3">
              <p className="text-xs text-mist">{formatTime(point.t)}</p>
              <p className="num mt-1 text-xl font-semibold">{formatNumber(point.grid_kw)}</p>
              <p className="text-[11px] text-mist">kW grid</p>
              <div className="mt-2">
                <StatusBadge status={point.status} />
              </div>
            </li>
          ))}
        </ol>
      </Panel>

      <ModelForecastCurve code={facility.code} gridKw={current.grid_kw} solarKw={current.solar_kw} />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel>
          <h2 className="font-display text-lg font-semibold">This week on the bill</h2>
          <p className="mt-1 text-sm text-mist">Trailing 7 days. Peak was {formatDayTime(billing.peak_at)}.</p>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Grid import" value={`${formatNumber(billing.grid_kwh)} kWh`} />
            <Row label="Solar generated" value={`${formatNumber(billing.solar_kwh)} kWh`} />
            <Row label="Peak demand" value={`${formatNumber(billing.peak_kw)} kW`} />
            <Row label="Energy charge" value={formatMoney(billing.energy_charge)} />
            <Row label="Demand charge" value={formatMoney(billing.demand_charge)} />
            <Row label="Overrun penalty" value={formatMoney(billing.penalty)} />
            <Row label="Estimated total" value={formatMoney(billing.total)} strong />
          </dl>
        </Panel>
        <Panel>
          <h2 className="font-display text-lg font-semibold">Utility contract</h2>
          <p className="mt-1 text-sm leading-6 text-mist">
            Warning at {formatNumber(warningPreview)} kW · critical at {formatNumber(criticalPreview)} kW.
            {limitPreview > 0 && current.grid_kw > limitPreview ? " Live demand is already above this limit." : ""}
          </p>
          {form && (
            <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
              <Field label="Contract limit (kW)" hint="Maximum metered demand the utility allows.">
                <TextInput
                  type="number"
                  min="1"
                  step="1"
                  value={form.contracted_limit_kw}
                  onChange={(event) => update("contracted_limit_kw", event.target.value)}
                />
              </Field>
              <Field label="Energy tariff ($/kWh)">
                <TextInput
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.rate_per_kwh}
                  onChange={(event) => update("rate_per_kwh", event.target.value)}
                />
              </Field>
              <Field label="Warning (%)" hint="Raises a warning at this share of the limit.">
                <TextInput
                  type="number"
                  min="1"
                  max="99"
                  step="1"
                  value={form.warning_pct}
                  onChange={(event) => update("warning_pct", event.target.value)}
                />
              </Field>
              <Field label="Critical (%)" hint="Raises a critical alert at this share of the limit.">
                <TextInput
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={form.critical_pct}
                  onChange={(event) => update("critical_pct", event.target.value)}
                />
              </Field>
              <Field label="Demand rate ($/kW)" hint="Monthly demand tariff. This week is priced as 7/30 of it.">
                <TextInput
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.demand_rate_per_kw}
                  onChange={(event) => update("demand_rate_per_kw", event.target.value)}
                />
              </Field>
              <Field label="Penalty ($/kW over)" hint="Charged on each kW the week's peak sits above the limit.">
                <TextInput
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.penalty_per_kw}
                  onChange={(event) => update("penalty_per_kw", event.target.value)}
                />
              </Field>
              <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-ivory disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save contract"}
                </button>
                {saved && <p className="text-sm text-moss">Contract saved. Alerts are using the new limits.</p>}
                {saveError && (
                  <p className="text-sm text-crit" role="alert">
                    {saveError}
                  </p>
                )}
              </div>
            </form>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Row({ label, value, strong = false }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/80 py-2 last:border-0">
      <dt className="text-mist">{label}</dt>
      <dd className={`num text-right ${strong ? "text-base font-semibold" : ""}`}>{value}</dd>
    </div>
  );
}

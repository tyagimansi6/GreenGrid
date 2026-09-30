import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney, formatNumber, formatTick, spanHours } from "../format";
import { theme } from "../theme";
import TrendChart from "./TrendChart";

function Tip({ active, payload, label, formatValue }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((item) => item.value != null && !Number.isNaN(item.value));
  if (!rows.length) return null;
  const render = formatValue || ((value) => `${formatNumber(value)} kW`);
  return (
    <div className="rounded-md bg-ink px-3 py-2 text-xs text-ivory shadow-card">
      <p className="mb-1 text-ivory/55">{label}</p>
      {rows.map((item) => (
        <p key={item.dataKey} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <i className="h-1.5 w-1.5 rounded-full" style={{ background: item.color }} />
            {item.name}
          </span>
          <span className="num">{render(item.value)}</span>
        </p>
      ))}
    </div>
  );
}

function LayerToggle({ on, color, label, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs ${
        on ? "border-line bg-paper text-ink" : "border-transparent text-mist"
      }`}
    >
      <i className="h-2 w-2 rounded-full" style={{ background: on ? color : theme.line }} />
      {label}
    </button>
  );
}

function axisMax(value) {
  const padded = Math.max(value, 1) * 1.06;
  const power = Math.pow(10, Math.floor(Math.log10(padded)));
  const step = power >= 10 ? power / 2 : 1;
  return Math.ceil(padded / step) * step;
}

export function DemandChart({ data, limit, warning, showForecast = false }) {
  const [layers, setLayers] = useState({ load: false, solar: true, forecast: true });
  const span = spanHours(data);
  const labeled = useMemo(
    () => (data || []).map((point) => ({ ...point, label: formatTick(point.t, span) })),
    [data, span],
  );
  const hasForecast = showForecast && labeled.some((point) => point.forecast_kw != null);
  const visibleValues = labeled.flatMap((point) => {
    const values = [point.grid_kw];
    if (layers.load) values.push(point.load_kw);
    if (layers.solar) values.push(point.solar_kw);
    if (hasForecast && layers.forecast) values.push(point.forecast_kw);
    return values.filter((value) => value != null);
  });
  const peak = Math.max(limit || 0, warning || 0, ...visibleValues, 1);

  const toggle = (key) => setLayers((current) => ({ ...current, [key]: !current[key] }));

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        <span className="inline-flex items-center gap-2 rounded-md border border-line bg-paper px-2.5 py-1 text-xs text-ink">
          <i className="h-2 w-2 rounded-full bg-ink" />
          Grid demand
        </span>
        <LayerToggle on={layers.load} color={theme.olive} label="Building load" onToggle={() => toggle("load")} />
        <LayerToggle on={layers.solar} color={theme.slate} label="Solar" onToggle={() => toggle("solar")} />
        {hasForecast && (
          <LayerToggle on={layers.forecast} color={theme.sage} label="Forecast" onToggle={() => toggle("forecast")} />
        )}
      </div>
      <TrendChart
        data={labeled}
        max={axisMax(peak)}
        warning={warning}
        limit={limit}
        height={320}
        series={[
          { key: "grid_kw", name: "Grid demand", color: theme.ink, width: 2.4, fill: true },
          layers.load ? { key: "load_kw", name: "Building load", color: theme.olive, width: 1.6 } : null,
          layers.solar ? { key: "solar_kw", name: "Solar", color: theme.slate, width: 1.8 } : null,
          hasForecast && layers.forecast
            ? { key: "forecast_kw", name: "Forecast", color: theme.sage, width: 2.2, dash: "6 4", dots: true }
            : null,
        ].filter(Boolean)}
      />
    </div>
  );
}

export function CostChart({ data }) {
  return (
    <div className="h-72 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={theme.grid} vertical={false} />
          <XAxis dataKey="code" tick={{ fill: theme.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fill: theme.muted, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={72}
            tickFormatter={(value) => formatMoney(value)}
          />
          <Tooltip content={<Tip formatValue={formatMoney} />} />
          <Bar dataKey="energy_charge" name="Energy" stackId="cost" fill={theme.slate} radius={[0, 0, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="demand_charge" name="Demand" stackId="cost" fill={theme.sage} isAnimationActive={false} />
          <Bar dataKey="penalty" name="Penalty" stackId="cost" fill={theme.crit} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

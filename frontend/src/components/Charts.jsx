import { useMemo, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney, formatNumber, formatTick, spanHours } from "../format";

function Tip({ active, payload, label, formatValue }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((item) => item.value != null && !Number.isNaN(item.value));
  if (!rows.length) return null;
  const render = formatValue || ((value) => `${formatNumber(value)} kW`);
  return (
    <div className="rounded-xl bg-ink px-3 py-2 text-xs text-white shadow-lg">
      <p className="mb-1 text-white/55">{label}</p>
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
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs ${
        on ? "border-ink/10 bg-paper text-ink" : "border-transparent text-mist"
      }`}
    >
      <i className="h-2 w-2 rounded-full" style={{ background: on ? color : "#c5d0c8" }} />
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
        <span className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-paper px-2.5 py-1 text-xs text-ink">
          <i className="h-2 w-2 rounded-full bg-moss" />
          Grid demand
        </span>
        <LayerToggle on={layers.load} color="#13261c" label="Building load" onToggle={() => toggle("load")} />
        <LayerToggle on={layers.solar} color="#d0891a" label="Solar" onToggle={() => toggle("solar")} />
        {hasForecast && (
          <LayerToggle on={layers.forecast} color="#3c6e91" label="Forecast" onToggle={() => toggle("forecast")} />
        )}
      </div>
      <div className="h-80 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={labeled} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gridFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1c7a4a" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#1c7a4a" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e3ebe6" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#5c6d63", fontSize: 12 }} axisLine={false} tickLine={false} minTickGap={28} />
            <YAxis
              domain={[0, axisMax(peak)]}
              tick={{ fill: "#5c6d63", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={48}
              tickFormatter={(value) => formatNumber(value)}
            />
            <Tooltip content={<Tip />} />
            {warning ? (
              <ReferenceLine
                y={warning}
                stroke="#b7791f"
                strokeDasharray="4 4"
                label={{ value: "Warning", fill: "#b7791f", fontSize: 11, position: "insideTopLeft" }}
              />
            ) : null}
            {limit ? (
              <ReferenceLine
                y={limit}
                stroke="#c83c3c"
                strokeDasharray="4 4"
                label={{ value: "Limit", fill: "#c83c3c", fontSize: 11, position: "insideTopLeft" }}
              />
            ) : null}
            <Area
              type="monotone"
              dataKey="grid_kw"
              name="Grid demand"
              stroke="#1c7a4a"
              strokeWidth={2.4}
              fill="url(#gridFill)"
              connectNulls={false}
              isAnimationActive={false}
            />
            {layers.load && (
              <Line
                type="monotone"
                dataKey="load_kw"
                name="Building load"
                stroke="#13261c"
                strokeWidth={1.6}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            )}
            {layers.solar && (
              <Line
                type="monotone"
                dataKey="solar_kw"
                name="Solar"
                stroke="#d0891a"
                strokeWidth={1.8}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            )}
            {hasForecast && layers.forecast && (
              <Line
                type="monotone"
                dataKey="forecast_kw"
                name="Forecast"
                stroke="#3c6e91"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function CostChart({ data }) {
  return (
    <div className="h-72 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#e3ebe6" vertical={false} />
          <XAxis dataKey="code" tick={{ fill: "#5c6d63", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fill: "#5c6d63", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={72}
            tickFormatter={(value) => formatMoney(value)}
          />
          <Tooltip content={<Tip formatValue={formatMoney} />} />
          <Bar dataKey="energy_charge" name="Energy" stackId="cost" fill="#1c7a4a" radius={[0, 0, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="demand_charge" name="Demand" stackId="cost" fill="#8fbfa3" isAnimationActive={false} />
          <Bar dataKey="penalty" name="Penalty" stackId="cost" fill="#c83c3c" radius={[6, 6, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

import { useMemo, useState } from "react";
import { formatTick, spanHours } from "../format";
import { theme } from "../theme";
import TrendChart from "./TrendChart";

function Toggle({ on, color, label, onToggle, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs ${
        disabled ? "cursor-default border-transparent text-mist/70" : on ? "border-line bg-paper text-ink" : "border-transparent text-mist"
      }`}
    >
      <i className="h-2 w-2 rounded-full" style={{ background: on && !disabled ? color : theme.line }} />
      {label}
    </button>
  );
}

function axisMax(value) {
  const padded = Math.max(value, 1) * 1.08;
  const power = Math.pow(10, Math.floor(Math.log10(padded)));
  const step = power >= 10 ? power / 2 : 1;
  return Math.ceil(padded / step) * step;
}

export default function EnergyConsumptionChart({ data, limit, warning }) {
  const [layers, setLayers] = useState({ solar: true, grid: true });
  const span = spanHours(data);
  const labeled = useMemo(
    () => (data || []).map((point) => ({ ...point, label: formatTick(point.t, span) })),
    [data, span],
  );
  const visible = labeled.flatMap((point) => {
    const values = [point.load_kw];
    if (layers.solar) values.push(point.solar_kw);
    if (layers.grid) values.push(point.grid_kw);
    return values.filter((value) => value != null);
  });
  const peak = Math.max(limit || 0, warning || 0, ...visible, 1);
  const toggle = (key) => setLayers((current) => ({ ...current, [key]: !current[key] }));

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        <span className="inline-flex items-center gap-2 rounded-md border border-line bg-paper px-2.5 py-1 text-xs text-ink">
          <i className="h-2 w-2 rounded-full" style={{ background: theme.ink }} />
          Total consumption
        </span>
        <Toggle on={layers.solar} color={theme.slate} label="Solar" onToggle={() => toggle("solar")} />
        <Toggle on={false} color={theme.sage} label="Wind · unmetered" disabled />
        <Toggle on={layers.grid} color={theme.bronze} label="Grid" onToggle={() => toggle("grid")} />
      </div>
      <TrendChart
        data={labeled}
        max={axisMax(peak)}
        warning={warning}
        limit={limit}
        height={320}
        series={[
          { key: "load_kw", name: "Total consumption", color: theme.ink, width: 2.4, fill: true },
          layers.solar ? { key: "solar_kw", name: "Solar", color: theme.slate, width: 1.8 } : null,
          layers.grid ? { key: "grid_kw", name: "Grid", color: theme.bronze, width: 1.8 } : null,
        ].filter(Boolean)}
      />
      {(warning || limit) && (
        <p className="mt-2 text-xs text-mist">
          {warning ? "Dashed bronze is the combined warning line. " : ""}
          {limit ? "Dashed clay is the sum of the contract limits." : ""}
        </p>
      )}
    </div>
  );
}

import { memo, useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatNumber, formatPercent } from "../format";
import { theme } from "../theme";

function Tip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-md bg-ink px-3 py-2 text-xs text-ivory shadow-card">
      <p>{item.name}</p>
      <p className="num mt-1">{formatNumber(item.value)} kWh</p>
    </div>
  );
}

function RenewableMix({ solarKwh = 0, gridKwh = 0, renewableShare }) {
  const solar = Number(solarKwh) || 0;
  const grid = Number(gridKwh) || 0;
  const total = solar + grid;
  const data = useMemo(
    () => [
      { name: "Solar", value: solar, color: theme.slate },
      { name: "Grid", value: grid, color: theme.bronze },
    ],
    [solar, grid],
  );

  return (
    <div>
      <div className="relative h-52 w-full min-w-0">
        {total <= 0 ? (
          <p className="grid h-full place-items-center text-sm text-mist">No generation in this window.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius="62%"
                outerRadius="84%"
                paddingAngle={2}
                stroke={theme.surface}
                strokeWidth={2}
                isAnimationActive={false}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={Tip} />
            </PieChart>
          </ResponsiveContainer>
        )}
        {total > 0 && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="text-center">
              <p className="num text-2xl font-semibold text-ink">{formatPercent(solar / total)}</p>
              <p className="text-[11px] uppercase tracking-[0.14em] text-mist">solar of supply</p>
            </div>
          </div>
        )}
      </div>
      <ul className="mt-2 space-y-2 text-sm">
        <li className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <i className="h-2 w-2 rounded-full bg-slate" />
            Solar
          </span>
          <span className="num text-mist">{formatNumber(solar)} kWh</span>
        </li>
        <li className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <i className="h-2 w-2 rounded-full bg-sage" />
            Wind
          </span>
          <span className="text-mist">Unmetered</span>
        </li>
        <li className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <i className="h-2 w-2 rounded-full bg-bronze" />
            Grid
          </span>
          <span className="num text-mist">{formatNumber(grid)} kWh</span>
        </li>
      </ul>
      {renewableShare != null && (
        <p className="mt-3 text-xs leading-5 text-mist">
          Solar covered {formatPercent(renewableShare)} of building load. Wind turbines are in the landscape and are not in this meter model.
        </p>
      )}
    </div>
  );
}

export default memo(RenewableMix);

import { formatNumber } from "../format";
import { theme } from "../theme";

const SOLAR_PATH = "M 236 104 C 310 104, 330 150, 400 176";
const WIND_PATH = "M 236 286 C 310 286, 334 248, 400 220";
const TIE_PATH = "M 620 198 C 690 198, 710 198, 784 198";

function Node({ x, y, w, h, accent, kicker, title, value, note }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="8" fill={theme.surface} stroke={theme.line} />
      <line x1={x + 10} y1={y} x2={x + w - 10} y2={y} stroke={accent} strokeWidth="2" />
      <text x={x + 16} y={y + 28} fill={theme.muted} fontSize="11" fontFamily="Outfit, sans-serif" letterSpacing="1.2">
        {kicker}
      </text>
      <text x={x + 16} y={y + 52} fill={theme.ink} fontSize="15" fontFamily="Syne, sans-serif">
        {title}
      </text>
      <text x={x + 16} y={y + 84} fill={theme.ink} fontSize="22" fontFamily="Outfit, sans-serif" fontWeight="600">
        {value}
      </text>
      <text x={x + 16} y={y + 106} fill={theme.muted} fontSize="12" fontFamily="Outfit, sans-serif">
        {note}
      </text>
    </g>
  );
}

function FlowCard({ kicker, title, value, note, accent }) {
  return (
    <article className="rounded-lg border border-line bg-surface px-4 py-3" style={{ borderTopColor: accent, borderTopWidth: 2 }}>
      <p className="text-[11px] uppercase tracking-[0.14em] text-mist">{kicker}</p>
      <h3 className="mt-1 font-display text-base font-semibold">{title}</h3>
      <p className="num mt-2 text-2xl font-semibold">{value}</p>
      <p className="text-xs text-mist">{note}</p>
    </article>
  );
}

export default function EnergyFlow({ solarKw = 0, gridKw = 0, loadKw = 0, facilities = 0 }) {
  const summary = `Solar ${formatNumber(solarKw)} kilowatts and grid import ${formatNumber(gridKw)} kilowatts supply ${facilities} facilities drawing ${formatNumber(loadKw)} kilowatts. Wind is unmetered.`;

  return (
    <figure>
      <div className="grid gap-3 lg:hidden">
        <div className="grid gap-3 sm:grid-cols-2">
          <FlowCard kicker="Generation" title="Solar" value={`${formatNumber(solarKw)} kW`} note="Metered, behind the facility" accent={theme.slate} />
          <FlowCard kicker="Generation" title="Wind" value="Unmetered" note="On the landscape, not in the feed" accent={theme.sage} />
        </div>
        <p className="text-center text-xs uppercase tracking-[0.16em] text-mist">into the yard</p>
        <FlowCard kicker="Infrastructure" title="Grid" value={`${formatNumber(gridKw)} kW`} note="Utility import, live" accent={theme.bronze} />
        <p className="text-center text-xs uppercase tracking-[0.16em] text-mist">into the facilities</p>
        <FlowCard kicker="Consumption" title="Facilities" value={`${formatNumber(loadKw)} kW`} note={`${facilities} sites on the portfolio`} accent={theme.ink} />
      </div>

      <svg viewBox="0 0 1020 380" className="hidden h-auto w-full lg:block" role="img" aria-label={summary}>
        <path d={SOLAR_PATH} fill="none" stroke={theme.slate} strokeWidth="1.6" className="flow-dash" />
        <path d={WIND_PATH} fill="none" stroke={theme.sage} strokeWidth="1.4" className="flow-still" />
        <path d={TIE_PATH} fill="none" stroke={theme.bronze} strokeWidth="1.6" className="flow-dash" />
        <circle r="2.4" fill={theme.slate}>
          <animateMotion dur="4.8s" repeatCount="indefinite" path={SOLAR_PATH} />
        </circle>
        <circle r="2.4" fill={theme.bronze}>
          <animateMotion dur="4.2s" repeatCount="indefinite" path={TIE_PATH} />
        </circle>
        <Node
          x={16}
          y={36}
          w={220}
          h={132}
          accent={theme.slate}
          kicker="GENERATION"
          title="Solar field"
          value={`${formatNumber(solarKw)} kW`}
          note="Metered on site"
        />
        <Node
          x={16}
          y={214}
          w={220}
          h={132}
          accent={theme.sage}
          kicker="GENERATION"
          title="Wind"
          value="Unmetered"
          note="No turbine feed"
        />
        <Node
          x={400}
          y={112}
          w={220}
          h={156}
          accent={theme.bronze}
          kicker="GRID YARD"
          title="Substation"
          value={`${formatNumber(gridKw)} kW`}
          note="Utility import"
        />
        <Node
          x={784}
          y={112}
          w={220}
          h={156}
          accent={theme.ink}
          kicker="CONSUMPTION"
          title="Facilities"
          value={`${formatNumber(loadKw)} kW`}
          note={`${facilities} buildings`}
        />
      </svg>
      <figcaption className="mt-3 text-xs leading-5 text-mist">
        Solar feeds the yard, and the yard feeds the facilities. Wind is drawn as it stands in the landscape. This meter model records on-site solar and utility import only.
      </figcaption>
    </figure>
  );
}

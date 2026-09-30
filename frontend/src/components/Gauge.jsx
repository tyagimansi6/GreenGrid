import { theme } from "../theme";

function pointOnArc(t) {
  const angle = Math.PI * (1 - t);
  return [90 + 74 * Math.cos(angle), 96 - 74 * Math.sin(angle)];
}

export default function Gauge({ utilization, warningRatio = 0.8, criticalRatio = 0.95, status }) {
  const maxRatio = 1.2;
  const progress = Math.max(0, Math.min(utilization, maxRatio)) / maxRatio;
  const length = Math.PI * 74;
  const color = status === "critical" ? theme.crit : status === "warning" ? theme.warn : theme.canopy;
  const marks = [
    { ratio: warningRatio, color: theme.warn },
    { ratio: criticalRatio, color: theme.crit },
    { ratio: 1, color: theme.ink },
  ];

  return (
    <svg viewBox="0 0 180 118" className="w-full max-w-[240px]" role="img" aria-label={`${Math.round(utilization * 100)} percent of contract limit`}>
      <path d="M 16 96 A 74 74 0 0 1 164 96" fill="none" stroke={theme.grid} strokeWidth="12" strokeLinecap="round" />
      <path
        d="M 16 96 A 74 74 0 0 1 164 96"
        fill="none"
        stroke={color}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${progress * length} ${length}`}
      />
      {marks.map((mark) => {
        const [x, y] = pointOnArc(Math.min(mark.ratio, maxRatio) / maxRatio);
        return <circle key={mark.ratio} cx={x} cy={y} r="3" fill={mark.color} />;
      })}
      <text x="90" y="82" textAnchor="middle" fill={theme.ink} fontFamily="Outfit, sans-serif" fontSize="28" fontWeight="600">
        {Math.round(utilization * 100)}%
      </text>
      <text x="90" y="102" textAnchor="middle" fill={theme.muted} fontFamily="Outfit, sans-serif" fontSize="11">
        of contract limit
      </text>
    </svg>
  );
}

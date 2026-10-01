import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import { formatNumber } from "../format";
import { theme } from "../theme";

const PAD = { top: 16, right: 12, bottom: 28, left: 52 };

function finite(value) {
  return value != null && Number.isFinite(Number(value));
}

function linePath(data, key, xAt, yAt) {
  let path = "";
  let drawing = false;
  data.forEach((point, index) => {
    if (!finite(point[key])) {
      drawing = false;
      return;
    }
    const command = drawing ? "L" : "M";
    path += `${command}${xAt(index).toFixed(2)} ${yAt(point[key]).toFixed(2)}`;
    drawing = true;
  });
  return path;
}

function areaPath(data, key, xAt, yAt, baseline) {
  let path = "";
  let run = [];
  function close() {
    if (run.length < 2) {
      run = [];
      return;
    }
    const first = run[0];
    const last = run[run.length - 1];
    path += `M${xAt(first).toFixed(2)} ${yAt(data[first][key]).toFixed(2)}`;
    run.slice(1).forEach((index) => {
      path += `L${xAt(index).toFixed(2)} ${yAt(data[index][key]).toFixed(2)}`;
    });
    path += `L${xAt(last).toFixed(2)} ${baseline.toFixed(2)}L${xAt(first).toFixed(2)} ${baseline.toFixed(2)}Z`;
    run = [];
  }
  data.forEach((point, index) => {
    if (!finite(point[key])) close();
    else run.push(index);
  });
  close();
  return path;
}

function tickIndexes(count) {
  if (count <= 1) return [0];
  const step = Math.max(1, Math.ceil((count - 1) / 5));
  const indexes = [];
  for (let index = 0; index < count; index += step) indexes.push(index);
  if (indexes[indexes.length - 1] !== count - 1) indexes.push(count - 1);
  return indexes;
}

function TrendChart({ data = [], series = [], height = 320, max = 1, warning, limit }) {
  const frame = useRef(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState(null);

  useLayoutEffect(() => {
    const node = frame.current;
    if (!node) return undefined;
    const measure = () => setWidth(node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const geometry = useMemo(() => {
    if (!width || !data.length) return null;
    const plotW = Math.max(width - PAD.left - PAD.right, 0);
    const plotH = Math.max(height - PAD.top - PAD.bottom, 0);
    const ceiling = Math.max(max, 1);
    const last = Math.max(data.length - 1, 1);
    const xAt = (index) => PAD.left + (index / last) * plotW;
    const yAt = (value) => PAD.top + (1 - Number(value) / ceiling) * plotH;
    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((step) => ceiling * step);
    const areas = series.map((item) =>
      item.fill ? { key: item.key, d: areaPath(data, item.key, xAt, yAt, yAt(0)), color: item.color } : null,
    );
    const lines = series.map((item) => ({
      key: item.key,
      d: linePath(data, item.key, xAt, yAt),
      color: item.color,
      width: item.width || 2,
      dash: item.dash,
    }));
    const dots = series.flatMap((item) =>
      item.dots
        ? data.flatMap((point, index) =>
            finite(point[item.key]) ? [{ key: `${item.key}-${index}`, cx: xAt(index), cy: yAt(point[item.key]), color: item.color }] : [],
          )
        : [],
    );
    const labels = tickIndexes(data.length).map((index) => ({
      index,
      x: xAt(index),
      label: data[index].label,
    }));
    return { plotW, last, xAt, yAt, yTicks, areas, lines, dots, labels };
  }, [data, series, width, height, max]);

  function move(event) {
    if (!geometry?.plotW) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const index = Math.round(((x - PAD.left) / geometry.plotW) * geometry.last);
    const next = Math.min(Math.max(index, 0), data.length - 1);
    setHover((current) => (current === next ? current : next));
  }

  const active = hover != null ? data[hover] : null;
  const rows = active
    ? series.filter((item) => finite(active[item.key])).map((item) => ({ ...item, value: active[item.key] }))
    : [];

  const xAt = geometry?.xAt;
  const yAt = geometry?.yAt;

  return (
    <div ref={frame} className="relative w-full" style={{ height }}>
      {geometry && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label="Demand trend with connected history and forecast"
          onMouseMove={move}
          onMouseLeave={() => setHover(null)}
        >
          {geometry.yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={yAt(tick)}
                y2={yAt(tick)}
                stroke={theme.grid}
              />
              <text x={PAD.left - 8} y={yAt(tick) + 4} textAnchor="end" fill={theme.muted} fontSize="11">
                {formatNumber(tick)}
              </text>
            </g>
          ))}
          {finite(warning) && warning > 0 && (
            <g>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={yAt(warning)}
                y2={yAt(warning)}
                stroke={theme.warn}
                strokeDasharray="4 4"
              />
              <text x={PAD.left + 6} y={yAt(warning) - 6} fill={theme.warn} fontSize="11">
                Warning
              </text>
            </g>
          )}
          {finite(limit) && limit > 0 && (
            <g>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={yAt(limit)}
                y2={yAt(limit)}
                stroke={theme.crit}
                strokeDasharray="4 4"
              />
              <text x={PAD.left + 6} y={yAt(limit) - 6} fill={theme.crit} fontSize="11">
                Limit
              </text>
            </g>
          )}
          {geometry.areas.map((item) =>
            item ? <path key={`${item.key}-fill`} d={item.d} fill={item.color} opacity="0.12" /> : null,
          )}
          {geometry.lines.map((item) => (
            <path
              key={item.key}
              d={item.d}
              fill="none"
              stroke={item.color}
              strokeWidth={item.width}
              strokeDasharray={item.dash}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {geometry.dots.map((dot) => (
            <circle key={dot.key} cx={dot.cx} cy={dot.cy} r="3" fill={dot.color} />
          ))}
          {hover != null && (
            <g>
              <line
                x1={xAt(hover)}
                x2={xAt(hover)}
                y1={PAD.top}
                y2={height - PAD.bottom}
                stroke={theme.line}
              />
              {rows.map((item) => (
                <circle key={item.key} cx={xAt(hover)} cy={yAt(item.value)} r="3.5" fill={theme.ivory} stroke={item.color} strokeWidth="2" />
              ))}
            </g>
          )}
          {geometry.labels.map((tick) => (
            <text
              key={tick.index}
              x={tick.x}
              y={height - 8}
              textAnchor="middle"
              fill={theme.muted}
              fontSize="11"
            >
              {tick.label}
            </text>
          ))}
        </svg>
      )}
      {active && rows.length > 0 && xAt && (
        <div
          className="pointer-events-none absolute z-10 rounded-md bg-ink px-3 py-2 text-xs text-ivory shadow-card"
          style={{
            left: Math.min(xAt(hover) + 12, Math.max(width - 180, 8)),
            top: 8,
          }}
        >
          <p className="mb-1 text-ivory/55">{active.label}</p>
          {rows.map((item) => (
            <p key={item.key} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5">
                <i className="h-1.5 w-1.5 rounded-full" style={{ background: item.color }} />
                {item.name}
              </span>
              <span className="num">{formatNumber(item.value)} kW</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(TrendChart);

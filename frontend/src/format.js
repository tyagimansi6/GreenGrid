export function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(Number(value) || 0);
}

export function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

export function formatPercent(ratio, digits = 0) {
  return `${formatNumber((Number(ratio) || 0) * 100, digits)}%`;
}

export function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function formatDayTime(iso) {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatAgo(iso) {
  if (!iso) return "just now";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export function formatTick(iso, spanHours = 24) {
  const date = new Date(iso);
  const withMinutes = date.getMinutes() !== 0;
  if (spanHours > 36) {
    return date.toLocaleString([], {
      weekday: "short",
      hour: "numeric",
      minute: withMinutes ? "2-digit" : undefined,
    });
  }
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: withMinutes ? "2-digit" : undefined,
  });
}

export function headroomText(headroomKw) {
  const amount = formatNumber(Math.abs(headroomKw));
  if (headroomKw >= 0) return `${amount} kW under the limit`;
  return `${amount} kW over the limit`;
}

export function spanHours(series) {
  if (!series?.length) return 24;
  const start = new Date(series[0].t).getTime();
  const end = new Date(series[series.length - 1].t).getTime();
  return Math.max(1, (end - start) / 36e5);
}

export function joinForecast(history, forecast) {
  const points = (history || []).map((point) => ({ ...point, forecast_kw: null }));
  if (!forecast?.length || !points.length) return points;
  const last = points[points.length - 1];
  points[points.length - 1] = { ...last, forecast_kw: last.grid_kw };
  forecast.forEach((point) => {
    points.push({
      t: point.t,
      grid_kw: null,
      load_kw: null,
      solar_kw: null,
      forecast_kw: point.grid_kw,
    });
  });
  return points;
}

import { api } from "./api";
import { formatNumber, formatPercent, formatTime } from "./format";

export const PROMPTS = [
  { id: "alerts", label: "Check critical alerts" },
  { id: "forecast", label: "Explain ML forecast" },
  { id: "shed", label: "Run emergency load shed" },
];

export const GREETING =
  "GREENY online. I read live demand, solar, site overloads, and the six-hour forecast. Ask a question, or use a prompt below.";

const INTENT_RULES = [
  ["shed", /\b(shed|emergency|curtail)\b/],
  ["forecast", /\b(forecast|predict|prediction|model|outlook)\b/],
  ["alerts", /\b(alert|critical|overload|warning|breach|alarm)\b/],
  ["solar", /\b(solar|renewable|generation)\b/],
  ["status", /\b(demand|load|portfolio|status|grid|headroom)\b/],
];

let forecastCache = { at: 0, key: "", map: null };

export function detectIntent(text) {
  const query = text.toLowerCase();
  const match = INTENT_RULES.find(([, pattern]) => pattern.test(query));
  return match ? match[0] : "unknown";
}

export async function composeReply(intent, dashboard) {
  if (!dashboard) {
    return "The live portfolio feed is offline. Start the GreenGrid API and I will read demand, solar, overloads, and the six-hour forecast from it.";
  }
  const details = intent === "forecast" ? await loadForecastDetails(dashboard.facilities) : null;
  return renderReply(intent, dashboard, details);
}

function renderReply(intent, dashboard, details) {
  const lead = portfolioLine(dashboard.kpis);
  if (intent === "alerts") return `${lead}\n\n${alertsBody(dashboard)}`;
  if (intent === "forecast") return `${lead}\n\n${forecastBody(dashboard, details)}`;
  if (intent === "shed") return `${lead}\n\n${shedBody(dashboard)}`;
  if (intent === "solar") return `${lead}\n\n${solarBody(dashboard)}`;
  if (intent === "status") return `${lead}\n\n${statusBody(dashboard)}`;
  return `${lead}\n\n${statusBody(dashboard)}\n\nI can check critical alerts, explain the six-hour forecast, or draft an emergency load shed.`;
}

function portfolioLine(kpis) {
  return `Live portfolio: ${formatNumber(kpis.live_load_kw)} kW demand, ${formatNumber(kpis.live_solar_kw)} kW solar, ${formatNumber(kpis.live_grid_kw)} kW grid import.`;
}

function alertsBody(dashboard) {
  const { kpis, alerts } = dashboard;
  const critical = alerts.filter((site) => site.status === "critical");
  const warning = alerts.filter((site) => site.status === "warning");
  if (!alerts.length) {
    return `No site is outside its warning line. All ${kpis.facility_count} facilities are inside plan.`;
  }
  const sections = [];
  if (critical.length) {
    sections.push(`Critical (${critical.length})\n${critical.map(siteBlock).join("\n\n")}`);
  } else {
    sections.push("No site is in the critical band.");
  }
  if (warning.length) {
    sections.push(`Warning (${warning.length})\n${warning.map(siteBlock).join("\n\n")}`);
  }
  return sections.join("\n\n");
}

function siteBlock(site) {
  const overrun = site.headroom_kw < 0 ? ` ${formatNumber(Math.abs(site.headroom_kw))} kW over the contract.` : "";
  return [
    `${site.name} · ${site.location}`,
    `${formatNumber(site.grid_kw)} kW grid on a ${formatNumber(site.contracted_limit_kw)} kW contract (${formatPercent(site.utilization)}).${overrun}`,
    site.message || site.forecast_note,
  ].join("\n");
}

function forecastBody(dashboard, details) {
  const sites = [...dashboard.facilities].sort(
    (a, b) => forecastRank(a) - forecastRank(b) || a.headroom_kw - b.headroom_kw,
  );
  const lines = sites.map((site) => forecastBlock(site, details?.[site.code]));
  return `Six-hour rolling forecast. Each hour is a regression on time of day and the previous hour of metered demand.\n\n${lines.join("\n\n")}`;
}

function forecastBlock(site, detail) {
  const points = detail?.forecast || [];
  if (!points.length) {
    return `${site.name}\n${site.forecast_note || "No forecast hours are available for this site."}`;
  }
  const hot = forecastRank(site) < 2;
  if (!hot) {
    const peak = points.reduce((best, point) => (point.grid_kw > best.grid_kw ? point : best));
    return `${site.name}\n${site.forecast_note} Peak ${formatNumber(peak.grid_kw)} kW at ${formatTime(peak.t)} (${peak.status}).`;
  }
  const hours = points
    .map((point) => `${formatTime(point.t)}  ${formatNumber(point.grid_kw)} kW  ${point.status}`)
    .join("\n");
  return `${site.name}\n${site.forecast_note}\n${hours}`;
}

function shedBody(dashboard) {
  const critical = dashboard.facilities.filter((site) => site.status === "critical");
  const watch = dashboard.facilities.filter(
    (site) => site.status !== "critical" && /critical/i.test(site.forecast_note || ""),
  );
  if (!critical.length) {
    const watchLine = watch.length
      ? `\n\nWatch, do not shed yet:\n${watch.map((site) => `${site.name} — ${site.forecast_note}`).join("\n")}`
      : "";
    return `No emergency shed is required. No meter is in the critical band.${watchLine}`;
  }
  const plans = critical.map((site) => {
    const target = Math.max(site.grid_kw - site.warning_kw, site.grid_kw - site.critical_kw, 0);
    const solar = site.solar_kw > 0 ? ` On-site solar is covering ${formatNumber(site.solar_kw)} kW of building load.` : " This site has no solar offset.";
    return `${site.name}\nMeter ${formatNumber(site.grid_kw)} kW · warning line ${formatNumber(site.warning_kw)} kW · shed ${formatNumber(target)} kW.${solar}`;
  });
  const total = critical.reduce(
    (sum, site) => sum + Math.max(site.grid_kw - site.warning_kw, site.grid_kw - site.critical_kw, 0),
    0,
  );
  const watchLine = watch.length
    ? `\n\nForecast is approaching critical, held out of this shed:\n${watch.map((site) => site.name).join(", ")}.`
    : "";
  return `Emergency shed plan from the live meters. This console does not open breakers. Drop the kilowatts below so each critical site falls back under its warning line.\n\n${plans.join("\n\n")}\n\nTotal shed target: ${formatNumber(total)} kW.${watchLine}`;
}

function solarBody(dashboard) {
  const { kpis, facilities } = dashboard;
  const sites = [...facilities].sort((a, b) => b.solar_kw - a.solar_kw);
  const rows = sites
    .map(
      (site) =>
        `${site.name} — ${formatNumber(site.solar_kw)} kW live of ${formatNumber(site.solar_capacity_kw)} kW capacity`,
    )
    .join("\n");
  return `Solar is ${formatPercent(kpis.renewable_share_24h)} of load over the last 24 hours (${formatNumber(kpis.solar_kwh_24h)} kWh generated).\n\n${rows}`;
}

function statusBody(dashboard) {
  const { kpis, facilities } = dashboard;
  const tightest = [...facilities].sort((a, b) => a.headroom_kw - b.headroom_kw)[0];
  const tight = tightest
    ? `\n\nTightest contract: ${tightest.name} at ${formatNumber(tightest.grid_kw)} kW, ${formatNumber(tightest.headroom_kw)} kW of headroom.`
    : "";
  return `${kpis.critical} critical, ${kpis.warning} warning, ${kpis.normal} normal across ${kpis.facility_count} sites. Portfolio headroom is ${formatNumber(kpis.headroom_kw)} kW under the combined contracts.${tight}`;
}

function forecastRank(site) {
  const note = site.forecast_note || "";
  if (site.status === "critical" || /crosses the critical|stays in the critical/i.test(note)) return 0;
  if (site.status === "warning" || /enters the warning|stays in the warning/i.test(note)) return 1;
  return 2;
}

async function loadForecastDetails(facilities) {
  const key = facilities.map((site) => site.code).join(",");
  if (forecastCache.map && forecastCache.key === key && Date.now() - forecastCache.at < 20000) {
    return forecastCache.map;
  }
  const pairs = await Promise.all(
    facilities.map(async (site) => {
      try {
        const detail = await api.facility(site.code);
        return [site.code, detail];
      } catch {
        return [site.code, null];
      }
    }),
  );
  const map = Object.fromEntries(pairs);
  forecastCache = { at: Date.now(), key, map };
  return map;
}

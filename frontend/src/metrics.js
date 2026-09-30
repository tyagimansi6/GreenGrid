/** US grid average used only to estimate carbon avoided by metered solar. */
export const CO2_KG_PER_KWH = 0.386;

export function carbonTonnesFromSolar(solarKwh) {
  return ((Number(solarKwh) || 0) * CO2_KG_PER_KWH) / 1000;
}

export function seriesPeak(series, key = "grid_kw") {
  if (!series?.length) return 0;
  return series.reduce((max, point) => Math.max(max, Number(point[key]) || 0), 0);
}

export function coverRatio(solar, load) {
  const base = Number(load) || 0;
  if (base <= 0) return 0;
  return (Number(solar) || 0) / base;
}

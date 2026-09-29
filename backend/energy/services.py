"""Alert classification, billing, and the payloads the dashboard reads."""

from __future__ import annotations

import math
from collections import defaultdict
from datetime import timedelta

from django.utils import timezone

from energy.ml.forecast import forecast_demand
from energy.models import Facility, Reading

STATUS_NORMAL = "normal"
STATUS_WARNING = "warning"
STATUS_CRITICAL = "critical"
RANK = {STATUS_NORMAL: 0, STATUS_WARNING: 1, STATUS_CRITICAL: 2}
WINDOW_DAYS = 7
DEMAND_PRORATE = 7 / 30


def classify(grid_kw, limit_kw, warning_ratio, critical_ratio):
    """Map metered demand to Normal, Warning, or Critical."""
    if limit_kw <= 0:
        return STATUS_NORMAL, 0.0
    utilization = grid_kw / limit_kw
    if utilization >= critical_ratio:
        return STATUS_CRITICAL, utilization
    if utilization >= warning_ratio:
        return STATUS_WARNING, utilization
    return STATUS_NORMAL, utilization


def live_multiplier(facility_id, now):
    """Small deterministic wobble so the dashboard moves between polls."""
    phase = facility_id * 1.3 + now.timestamp() / 30.0
    return 1 + 0.025 * math.sin(phase)


def _context():
    now = timezone.now()
    since = now - timedelta(days=WINDOW_DAYS)
    facilities = list(Facility.objects.all())
    grouped = defaultdict(list)
    readings = (
        Reading.objects.filter(recorded_at__gte=since)
        .select_related("facility")
        .order_by("recorded_at")
    )
    for reading in readings:
        grouped[reading.facility_id].append(reading)
    return {"now": now, "facilities": facilities, "grouped": grouped}


def _snapshot(facility, readings, now):
    last = readings[-1]
    grid_kw = max(0.0, last.grid_kw * live_multiplier(facility.id, now))
    solar_kw = max(0.0, last.solar_kw)
    load_kw = grid_kw + solar_kw
    status, utilization = classify(
        grid_kw,
        facility.contracted_limit_kw,
        facility.warning_ratio,
        facility.critical_ratio,
    )
    return {
        "grid_kw": round(grid_kw, 1),
        "load_kw": round(load_kw, 1),
        "solar_kw": round(solar_kw, 1),
        "status": status,
        "utilization": round(utilization, 4),
        "headroom_kw": round(facility.contracted_limit_kw - grid_kw, 1),
        "limit_kw": facility.contracted_limit_kw,
        "warning_kw": round(facility.contracted_limit_kw * facility.warning_ratio, 1),
        "critical_kw": round(facility.contracted_limit_kw * facility.critical_ratio, 1),
        "as_of": now.isoformat(),
    }


def _forecast(facility, readings):
    if len(readings) < 24:
        return []
    times = [timezone.localtime(reading.recorded_at) for reading in readings]
    predicted = forecast_demand(times, [reading.grid_kw for reading in readings], steps=6)
    start = times[-1]
    points = []
    for step, value in enumerate(predicted, start=1):
        moment = start + timedelta(hours=step)
        status, utilization = classify(
            value,
            facility.contracted_limit_kw,
            facility.warning_ratio,
            facility.critical_ratio,
        )
        points.append(
            {
                "t": moment.isoformat(),
                "grid_kw": round(value, 1),
                "status": status,
                "utilization": round(utilization, 4),
            }
        )
    return points


def _forecast_note(points, current_status):
    if not points:
        return "Not enough history to forecast this site."
    ranks = [RANK[point["status"]] for point in points]
    worst = max(ranks)
    ending = ranks[-1]
    current = RANK[current_status]
    if worst > current and worst == RANK[STATUS_CRITICAL]:
        return "Forecast crosses the critical line within 6 hours."
    if worst > current:
        return "Forecast enters the warning band within 6 hours."
    if ending < current:
        return "Forecast eases into a lower band within 6 hours."
    if current_status == STATUS_CRITICAL:
        return "Forecast stays in the critical band for the next 6 hours."
    if current_status == STATUS_WARNING:
        return "Forecast stays in the warning band for the next 6 hours."
    return "Forecast stays under the warning line for the next 6 hours."


def _episode_start(readings, facility, live_status, now):
    if live_status == STATUS_NORMAL:
        return None
    current = RANK[live_status]
    started = now
    for reading in reversed(readings):
        status, _ = classify(
            reading.grid_kw,
            facility.contracted_limit_kw,
            facility.warning_ratio,
            facility.critical_ratio,
        )
        if RANK[status] >= current:
            started = reading.recorded_at
        else:
            break
    return started


def _alert_message(status, grid_kw, limit_kw):
    if status == STATUS_CRITICAL and grid_kw >= limit_kw:
        return "Metered demand is above the utility contract. Overrun penalties apply, and the site is at risk of a local overload."
    if status == STATUS_CRITICAL:
        return "Metered demand crossed the critical line and is closing on the contract limit."
    if status == STATUS_WARNING:
        return "Demand passed the warning line. There is still room under the contract, but this site needs attention."
    return ""


def _facility_payload(facility):
    return {
        "id": facility.id,
        "code": facility.code,
        "name": facility.name,
        "location": facility.location,
        "facility_type": facility.facility_type,
        "contracted_limit_kw": facility.contracted_limit_kw,
        "warning_ratio": facility.warning_ratio,
        "critical_ratio": facility.critical_ratio,
        "rate_per_kwh": float(facility.rate_per_kwh),
        "demand_rate_per_kw": float(facility.demand_rate_per_kw),
        "penalty_per_kw": float(facility.penalty_per_kw),
        "solar_capacity_kw": facility.solar_capacity_kw,
    }


def _summary(facility, readings, now):
    current = _snapshot(facility, readings, now)
    forecast = _forecast(facility, readings)
    started = _episode_start(readings, facility, current["status"], now)
    payload = _facility_payload(facility)
    payload.update(current)
    payload["forecast_note"] = _forecast_note(forecast, current["status"])
    payload["since"] = started.isoformat() if started else None
    payload["message"] = _alert_message(current["status"], current["grid_kw"], facility.contracted_limit_kw)
    return payload


def _ordered(summaries):
    return sorted(summaries, key=lambda item: (RANK[item["status"]] * -1, -item["utilization"]))


def build_summaries(ctx=None):
    ctx = ctx or _context()
    summaries = []
    for facility in ctx["facilities"]:
        readings = ctx["grouped"].get(facility.id, [])
        if not readings:
            continue
        summaries.append(_summary(facility, readings, ctx["now"]))
    return _ordered(summaries)


def _recommendations(facility, current, forecast, billing_site):
    notes = []
    if current["status"] == STATUS_CRITICAL:
        over = max(0.0, current["grid_kw"] - current["critical_kw"])
        notes.append(
            {
                "tone": "critical",
                "title": "Bring this site back under the critical line",
                "detail": (
                    f"Live grid demand is {current['grid_kw']:.0f} kW. "
                    f"Shed about {max(over, current['grid_kw'] - current['warning_kw']):.0f} kW "
                    "to leave the critical band, or more to clear the warning line."
                ),
            }
        )
    elif current["status"] == STATUS_WARNING:
        notes.append(
            {
                "tone": "warning",
                "title": "Hold demand here",
                "detail": (
                    f"{current['headroom_kw']:.0f} kW of contract headroom remains. "
                    "Delay flexible equipment before the next peak hour."
                ),
            }
        )

    upcoming = next((point for point in forecast if RANK[point["status"]] > RANK[current["status"]]), None)
    if upcoming:
        notes.append(
            {
                "tone": "warning",
                "title": "The next few hours trend hotter",
                "detail": "The forecast steps into a higher alert band. Shift deferrable load, or pre-cool, before that hour arrives.",
            }
        )

    if facility.solar_capacity_kw > 0:
        notes.append(
            {
                "tone": "info",
                "title": "Use the solar window",
                "detail": (
                    f"This site can generate up to {facility.solar_capacity_kw:.0f} kW. "
                    "Run flexible loads from late morning through mid-afternoon so solar covers them instead of the grid."
                ),
            }
        )

    if billing_site and billing_site["penalty"] > 0:
        notes.append(
            {
                "tone": "critical",
                "title": "This week already has an overrun",
                "detail": (
                    f"Peak grid demand was {billing_site['peak_kw']:.0f} kW against a "
                    f"{billing_site['limit_kw']:.0f} kW contract. Estimated penalty: "
                    f"${billing_site['penalty']:.0f}."
                ),
            }
        )
    return notes[:3]


def _site_billing(facility, readings):
    if not readings:
        return None
    peak = max(readings, key=lambda reading: reading.grid_kw)
    grid_kwh = sum(reading.grid_kwh for reading in readings)
    solar_kwh = sum(reading.solar_kwh for reading in readings)
    load_kwh = sum(reading.load_kwh for reading in readings)
    export_kwh = sum(reading.export_kwh for reading in readings)
    energy = grid_kwh * float(facility.rate_per_kwh)
    demand = peak.grid_kw * float(facility.demand_rate_per_kw) * DEMAND_PRORATE
    penalty = max(0.0, peak.grid_kw - facility.contracted_limit_kw) * float(facility.penalty_per_kw)
    peak_status, peak_utilization = classify(
        peak.grid_kw,
        facility.contracted_limit_kw,
        facility.warning_ratio,
        facility.critical_ratio,
    )
    return {
        "code": facility.code,
        "name": facility.name,
        "location": facility.location,
        "facility_type": facility.facility_type,
        "limit_kw": facility.contracted_limit_kw,
        "grid_kwh": round(grid_kwh, 1),
        "solar_kwh": round(solar_kwh, 1),
        "load_kwh": round(load_kwh, 1),
        "export_kwh": round(export_kwh, 1),
        "peak_kw": round(peak.grid_kw, 1),
        "peak_at": peak.recorded_at.isoformat(),
        "peak_status": peak_status,
        "peak_utilization": round(peak_utilization, 4),
        "energy_charge": round(energy, 2),
        "demand_charge": round(demand, 2),
        "penalty": round(penalty, 2),
        "total": round(energy + demand + penalty, 2),
        "solar_capacity_kw": facility.solar_capacity_kw,
    }


def build_billing(ctx=None):
    ctx = ctx or _context()
    sites = []
    for facility in ctx["facilities"]:
        site = _site_billing(facility, ctx["grouped"].get(facility.id, []))
        if site:
            sites.append(site)
    sites.sort(key=lambda site: site["total"], reverse=True)
    totals = {
        "energy": round(sum(site["energy_charge"] for site in sites), 2),
        "demand": round(sum(site["demand_charge"] for site in sites), 2),
        "penalty": round(sum(site["penalty"] for site in sites), 2),
        "total": round(sum(site["total"] for site in sites), 2),
        "grid_kwh": round(sum(site["grid_kwh"] for site in sites), 1),
        "solar_kwh": round(sum(site["solar_kwh"] for site in sites), 1),
        "export_kwh": round(sum(site["export_kwh"] for site in sites), 1),
    }
    return {
        "window_days": WINDOW_DAYS,
        "generated_at": ctx["now"].isoformat(),
        "note": (
            "Energy is the exact grid import over the last 7 days. "
            "The demand charge is this week's share of a monthly rate (peak kW × tariff × 7/30). "
            "The penalty is charged on every kW the week's peak sits above the contract limit."
        ),
        "totals": totals,
        "sites": sites,
    }


def _series_point(moment, grid_kw, load_kw, solar_kw):
    return {
        "t": moment.isoformat(),
        "grid_kw": round(grid_kw, 1),
        "load_kw": round(load_kw, 1),
        "solar_kw": round(solar_kw, 1),
    }


def build_dashboard():
    ctx = _context()
    summaries = build_summaries(ctx)
    billing = build_billing(ctx)
    cutoff = ctx["now"] - timedelta(hours=24)
    buckets = defaultdict(lambda: {"grid": 0.0, "load": 0.0, "solar": 0.0, "t": None})
    grid_kwh = solar_kwh = load_kwh = 0.0
    for facility in ctx["facilities"]:
        for reading in ctx["grouped"].get(facility.id, []):
            if reading.recorded_at < cutoff:
                continue
            key = reading.recorded_at.isoformat()
            bucket = buckets[key]
            bucket["t"] = reading.recorded_at
            bucket["grid"] += reading.grid_kw
            bucket["load"] += reading.load_kw
            bucket["solar"] += reading.solar_kw
            grid_kwh += reading.grid_kwh
            solar_kwh += reading.solar_kwh
            load_kwh += reading.load_kwh

    series = [
        _series_point(buckets[key]["t"], buckets[key]["grid"], buckets[key]["load"], buckets[key]["solar"])
        for key in sorted(buckets)
    ]
    if summaries:
        series.append(
            _series_point(
                ctx["now"],
                sum(item["grid_kw"] for item in summaries),
                sum(item["load_kw"] for item in summaries),
                sum(item["solar_kw"] for item in summaries),
            )
        )

    limit_kw = sum(item["contracted_limit_kw"] for item in summaries)
    warning_kw = sum(item["warning_kw"] for item in summaries)
    live_grid = sum(item["grid_kw"] for item in summaries)
    return {
        "generated_at": ctx["now"].isoformat(),
        "kpis": {
            "facility_count": len(summaries),
            "live_grid_kw": round(live_grid, 1),
            "live_load_kw": round(sum(item["load_kw"] for item in summaries), 1),
            "live_solar_kw": round(sum(item["solar_kw"] for item in summaries), 1),
            "contract_limit_kw": round(limit_kw, 1),
            "headroom_kw": round(limit_kw - live_grid, 1),
            "normal": sum(item["status"] == STATUS_NORMAL for item in summaries),
            "warning": sum(item["status"] == STATUS_WARNING for item in summaries),
            "critical": sum(item["status"] == STATUS_CRITICAL for item in summaries),
            "grid_kwh_24h": round(grid_kwh, 1),
            "solar_kwh_24h": round(solar_kwh, 1),
            "load_kwh_24h": round(load_kwh, 1),
            "renewable_share_24h": round(solar_kwh / load_kwh, 4) if load_kwh else 0,
            "penalty_7d": billing["totals"]["penalty"],
        },
        "portfolio": {
            "limit_kw": round(limit_kw, 1),
            "warning_kw": round(warning_kw, 1),
            "series": series,
        },
        "facilities": summaries,
        "alerts": [item for item in summaries if item["status"] != STATUS_NORMAL],
    }


def build_alerts():
    ctx = _context()
    summaries = build_summaries(ctx)
    return {
        "generated_at": ctx["now"].isoformat(),
        "alerts": [item for item in summaries if item["status"] != STATUS_NORMAL],
    }


def build_renewables():
    ctx = _context()
    billing = build_billing(ctx)
    cutoff = ctx["now"] - timedelta(hours=48)
    buckets = defaultdict(lambda: {"grid": 0.0, "load": 0.0, "solar": 0.0, "t": None})
    for facility in ctx["facilities"]:
        for reading in ctx["grouped"].get(facility.id, []):
            if reading.recorded_at < cutoff:
                continue
            key = reading.recorded_at.isoformat()
            bucket = buckets[key]
            bucket["t"] = reading.recorded_at
            bucket["grid"] += reading.grid_kw
            bucket["load"] += reading.load_kw
            bucket["solar"] += reading.solar_kw
    series = [
        _series_point(buckets[key]["t"], buckets[key]["grid"], buckets[key]["load"], buckets[key]["solar"])
        for key in sorted(buckets)
    ]
    sites = []
    for site in billing["sites"]:
        offset = site["solar_kwh"] / site["load_kwh"] if site["load_kwh"] else 0
        sites.append(
            {
                "code": site["code"],
                "name": site["name"],
                "facility_type": site["facility_type"],
                "solar_capacity_kw": site["solar_capacity_kw"],
                "solar_kwh": site["solar_kwh"],
                "export_kwh": site["export_kwh"],
                "grid_kwh": site["grid_kwh"],
                "offset_ratio": round(offset, 4),
            }
        )
    sites.sort(key=lambda site: site["solar_kwh"], reverse=True)
    load_kwh = sum(site["load_kwh"] for site in billing["sites"])
    solar_kwh = billing["totals"]["solar_kwh"]
    return {
        "generated_at": ctx["now"].isoformat(),
        "window_days": WINDOW_DAYS,
        "capacity_kw": round(sum(facility.solar_capacity_kw for facility in ctx["facilities"]), 1),
        "solar_kwh": solar_kwh,
        "grid_kwh": billing["totals"]["grid_kwh"],
        "export_kwh": billing["totals"]["export_kwh"],
        "offset_ratio": round(solar_kwh / load_kwh, 4) if load_kwh else 0,
        "series": series,
        "sites": sites,
    }


def build_facility_detail(code):
    ctx = _context()
    facility = next((item for item in ctx["facilities"] if item.code.lower() == code.lower()), None)
    if facility is None:
        return None
    readings = ctx["grouped"].get(facility.id, [])
    if not readings:
        return None
    current = _snapshot(facility, readings, ctx["now"])
    forecast = _forecast(facility, readings)
    billing_site = _site_billing(facility, readings)
    cutoff = ctx["now"] - timedelta(hours=48)
    history = [
        _series_point(reading.recorded_at, reading.grid_kw, reading.load_kw, reading.solar_kw)
        for reading in readings
        if reading.recorded_at >= cutoff
    ]
    history.append(_series_point(ctx["now"], current["grid_kw"], current["load_kw"], current["solar_kw"]))
    return {
        "generated_at": ctx["now"].isoformat(),
        "facility": _facility_payload(facility),
        "current": current,
        "history": history,
        "forecast": forecast,
        "forecast_note": _forecast_note(forecast, current["status"]),
        "billing": billing_site,
        "recommendations": _recommendations(facility, current, forecast, billing_site),
    }

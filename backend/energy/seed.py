"""Deterministic week of meter readings for the six demo sites."""

from __future__ import annotations

import math
import random
from datetime import timedelta
from decimal import Decimal

from django.utils import timezone

from energy.models import Facility, Reading

HOURS = 24 * 7
LIVE_GRID = {
    "HARBOR": 2510,
    "NORDC": 3610,
    "CIVIC": 540,
    "LAKES": 3140,
    "MERID": 430,
    "RIVER": 1290,
}
SPIKE_SITES = {"HARBOR", "LAKES"}


def load_factor(kind, hour):
    if kind == "Data Center":
        return 0.88 if 10 <= hour <= 18 else 0.76
    if kind == "Hospital":
        return 0.90 if 7 <= hour <= 21 else 0.74
    if kind == "Office":
        return 0.68 if 8 <= hour <= 18 else 0.18
    if kind == "Manufacturing":
        return 0.92 if 6 <= hour <= 21 else 0.32
    if kind == "Campus":
        return 0.38 if 8 <= hour <= 19 else 0.26
    return 0.80 + 0.05 * math.sin((hour - 16) / 24 * 2 * math.pi)


def solar_output(capacity, hour, rng):
    if capacity <= 0 or hour < 6 or hour >= 19:
        return 0.0
    shape = math.sin(math.pi * (hour - 6) / 13)
    return max(0.0, capacity * shape * rng.uniform(0.78, 1.0))


def _specs():
    return [
        {
            "name": "Harborview Medical Center",
            "code": "HARBOR",
            "location": "Seattle, WA",
            "facility_type": "Hospital",
            "contracted_limit_kw": 2400,
            "warning_ratio": 0.80,
            "critical_ratio": 0.95,
            "rate_per_kwh": Decimal("0.1420"),
            "demand_rate_per_kw": Decimal("22.00"),
            "penalty_per_kw": Decimal("65.00"),
            "solar_capacity_kw": 200,
        },
        {
            "name": "Northwind Data Hall",
            "code": "NORDC",
            "location": "Ashburn, VA",
            "facility_type": "Data Center",
            "contracted_limit_kw": 4200,
            "warning_ratio": 0.80,
            "critical_ratio": 0.95,
            "rate_per_kwh": Decimal("0.0980"),
            "demand_rate_per_kw": Decimal("18.00"),
            "penalty_per_kw": Decimal("40.00"),
            "solar_capacity_kw": 0,
        },
        {
            "name": "Civic Center Campus",
            "code": "CIVIC",
            "location": "Austin, TX",
            "facility_type": "Campus",
            "contracted_limit_kw": 1800,
            "warning_ratio": 0.80,
            "critical_ratio": 0.95,
            "rate_per_kwh": Decimal("0.1210"),
            "demand_rate_per_kw": Decimal("15.00"),
            "penalty_per_kw": Decimal("35.00"),
            "solar_capacity_kw": 860,
        },
        {
            "name": "Lakeside Manufacturing",
            "code": "LAKES",
            "location": "Detroit, MI",
            "facility_type": "Manufacturing",
            "contracted_limit_kw": 3100,
            "warning_ratio": 0.80,
            "critical_ratio": 0.95,
            "rate_per_kwh": Decimal("0.0890"),
            "demand_rate_per_kw": Decimal("16.00"),
            "penalty_per_kw": Decimal("48.00"),
            "solar_capacity_kw": 260,
        },
        {
            "name": "Meridian Office Tower",
            "code": "MERID",
            "location": "Chicago, IL",
            "facility_type": "Office",
            "contracted_limit_kw": 960,
            "warning_ratio": 0.80,
            "critical_ratio": 0.95,
            "rate_per_kwh": Decimal("0.1560"),
            "demand_rate_per_kw": Decimal("19.00"),
            "penalty_per_kw": Decimal("55.00"),
            "solar_capacity_kw": 150,
        },
        {
            "name": "Riverside Cold Storage",
            "code": "RIVER",
            "location": "Newark, NJ",
            "facility_type": "Warehouse",
            "contracted_limit_kw": 1500,
            "warning_ratio": 0.80,
            "critical_ratio": 0.95,
            "rate_per_kwh": Decimal("0.1080"),
            "demand_rate_per_kw": Decimal("14.00"),
            "penalty_per_kw": Decimal("38.00"),
            "solar_capacity_kw": 420,
        },
    ]


def seed_demo(*, reset=False):
    """Load demo facilities. Returns True when data was written."""
    if Facility.objects.exists():
        if not reset:
            return False
        Reading.objects.all().delete()
        Facility.objects.all().delete()

    rng = random.Random(7)
    local_now = timezone.localtime().replace(minute=0, second=0, microsecond=0)
    start = local_now - timedelta(hours=HOURS - 1)
    facilities = [Facility.objects.create(**spec) for spec in _specs()]
    rows = []
    for facility in facilities:
        limit = facility.contracted_limit_kw
        for step in range(HOURS):
            moment = start + timedelta(hours=step)
            hour = moment.hour
            load = limit * load_factor(facility.facility_type, hour) * rng.uniform(0.97, 1.03)
            solar = solar_output(facility.solar_capacity_kw, hour, rng)
            if facility.code in SPIKE_SITES and 12 <= hour <= 14 and moment.weekday() in {0, 1, 3}:
                load = limit * rng.uniform(1.04, 1.09) + solar
            grid = max(0.0, load - solar)
            export = max(0.0, solar - load)
            rows.append(
                Reading(
                    facility=facility,
                    recorded_at=moment,
                    load_kw=round(load, 2),
                    solar_kw=round(solar, 2),
                    grid_kw=round(grid, 2),
                    load_kwh=round(load, 2),
                    solar_kwh=round(solar, 2),
                    grid_kwh=round(grid, 2),
                    export_kwh=round(export, 2),
                )
            )
    Reading.objects.bulk_create(rows, batch_size=500)

    for facility in facilities:
        reading = facility.readings.order_by("-recorded_at").first()
        solar = reading.solar_kw
        grid = LIVE_GRID[facility.code]
        reading.grid_kw = grid
        reading.grid_kwh = grid
        reading.solar_kw = solar
        reading.solar_kwh = solar
        reading.load_kw = round(grid + solar, 2)
        reading.load_kwh = reading.load_kw
        reading.export_kwh = 0
        reading.save()
    return True

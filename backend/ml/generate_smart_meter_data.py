"""Synthetic 30-minute smart-meter telemetry for the six enterprise facilities.

The window is 1 January 2026 through 30 June 2026 inclusive: 181 days, 48
intervals per day, and 6 facilities, which is 52,128 readings. Timestamps are
UTC. Weather, occupancy, heating and cooling balance points, and solar use
each site's local time, including US daylight saving.

Run from the repository root::

    python backend/ml/generate_smart_meter_data.py
"""

from __future__ import annotations

import math
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd

COLUMNS = [
    "timestamp",
    "facility_id",
    "temperature_c",
    "humidity_pct",
    "wind_speed_ms",
    "previous_hour_demand_kw",
    "actual_demand_kw",
    "solar_generation_kw",
]

START = datetime(2026, 1, 1, tzinfo=timezone.utc)
END = datetime(2026, 7, 1, tzinfo=timezone.utc)
STEP = timedelta(minutes=30)
LAG = timedelta(hours=1)
SEED = 42

DEFAULT_CSV = Path(__file__).resolve().parent / "data" / "smart_meter_telemetry.csv"

# Ids match energy.seed creation order. tz_offset_hours is standard time;
# daylight saving adds one hour from the second Sunday in March.
FACILITIES = [
    {
        "id": 1,
        "name": "Harborview",
        "latitude": 47.6062,
        "longitude": -122.3321,
        "tz_offset_hours": -8,
        "base_day_kw": 1500.0,
        "base_night_kw": 1240.0,
        "occupied_start": 7.0,
        "occupied_end": 21.0,
        "weekend_factor": 0.94,
        "cool_balance_c": 17.0,
        "heat_balance_c": 15.0,
        "cool_kw_per_c": 18.0,
        "heat_kw_per_c": 16.0,
        "noise_frac": 0.018,
        "solar_capacity_kw": 200.0,
        "mean_c": 11.5,
        "seasonal_amp": 7.0,
        "diurnal_amp": 4.5,
        "humidity_mean": 76.0,
        "wind_mean": 3.4,
    },
    {
        "id": 2,
        "name": "Northwind",
        "latitude": 39.0438,
        "longitude": -77.4874,
        "tz_offset_hours": -5,
        "base_day_kw": 3280.0,
        "base_night_kw": 3120.0,
        "occupied_start": 0.0,
        "occupied_end": 24.0,
        "weekend_factor": 1.0,
        "cool_balance_c": 14.0,
        "heat_balance_c": -20.0,
        "cool_kw_per_c": 24.0,
        "heat_kw_per_c": 0.0,
        "noise_frac": 0.012,
        "solar_capacity_kw": 0.0,
        "mean_c": 14.0,
        "seasonal_amp": 12.0,
        "diurnal_amp": 6.0,
        "humidity_mean": 68.0,
        "wind_mean": 3.0,
    },
    {
        "id": 3,
        "name": "Civic Center",
        "latitude": 30.2672,
        "longitude": -97.7431,
        "tz_offset_hours": -6,
        "base_day_kw": 640.0,
        "base_night_kw": 310.0,
        "occupied_start": 8.0,
        "occupied_end": 19.0,
        "weekend_factor": 0.42,
        "cool_balance_c": 20.0,
        "heat_balance_c": 12.0,
        "cool_kw_per_c": 42.0,
        "heat_kw_per_c": 8.0,
        "noise_frac": 0.022,
        "solar_capacity_kw": 860.0,
        "mean_c": 20.5,
        "seasonal_amp": 9.5,
        "diurnal_amp": 6.5,
        "humidity_mean": 66.0,
        "wind_mean": 3.6,
    },
    {
        "id": 4,
        "name": "Lakeside",
        "latitude": 42.3314,
        "longitude": -83.0458,
        "tz_offset_hours": -5,
        "base_day_kw": 1760.0,
        "base_night_kw": 620.0,
        "occupied_start": 6.0,
        "occupied_end": 22.0,
        "weekend_factor": 0.38,
        "cool_balance_c": 18.0,
        "heat_balance_c": 14.0,
        "cool_kw_per_c": 22.0,
        "heat_kw_per_c": 36.0,
        "noise_frac": 0.02,
        "solar_capacity_kw": 260.0,
        "mean_c": 10.0,
        "seasonal_amp": 13.0,
        "diurnal_amp": 5.5,
        "humidity_mean": 70.0,
        "wind_mean": 4.2,
    },
    {
        "id": 5,
        "name": "Meridian",
        "latitude": 41.8781,
        "longitude": -87.6298,
        "tz_offset_hours": -6,
        "base_day_kw": 430.0,
        "base_night_kw": 95.0,
        "occupied_start": 8.0,
        "occupied_end": 18.0,
        "weekend_factor": 0.18,
        "cool_balance_c": 18.0,
        "heat_balance_c": 15.0,
        "cool_kw_per_c": 18.0,
        "heat_kw_per_c": 14.0,
        "noise_frac": 0.025,
        "solar_capacity_kw": 150.0,
        "mean_c": 10.5,
        "seasonal_amp": 13.5,
        "diurnal_amp": 5.5,
        "humidity_mean": 68.0,
        "wind_mean": 4.4,
    },
    {
        "id": 6,
        "name": "Riverside",
        "latitude": 40.7357,
        "longitude": -74.1724,
        "tz_offset_hours": -5,
        "base_day_kw": 560.0,
        "base_night_kw": 490.0,
        "occupied_start": 6.0,
        "occupied_end": 20.0,
        "weekend_factor": 0.9,
        "cool_balance_c": 8.0,
        "heat_balance_c": 0.0,
        "cool_kw_per_c": 26.0,
        "heat_kw_per_c": 4.0,
        "noise_frac": 0.02,
        "solar_capacity_kw": 420.0,
        "mean_c": 12.5,
        "seasonal_amp": 12.5,
        "diurnal_amp": 5.5,
        "humidity_mean": 67.0,
        "wind_mean": 4.0,
    },
]


def _hour_fraction(moment):
    return moment.hour + moment.minute / 60.0


def _nth_sunday(year, month, n):
    first = datetime(year, month, 1)
    days_until_sunday = (6 - first.weekday()) % 7
    return 1 + days_until_sunday + (n - 1) * 7


def _local_offset_hours(moment_utc, standard_offset):
    """US civil offset: standard time, plus one hour during daylight saving."""
    year = moment_utc.year
    start_day = _nth_sunday(year, 3, 2)
    end_day = _nth_sunday(year, 11, 1)
    dst_start = datetime(year, 3, start_day, 2, tzinfo=timezone.utc) - timedelta(hours=standard_offset)
    dst_end = datetime(year, 11, end_day, 1, tzinfo=timezone.utc) - timedelta(hours=standard_offset)
    if dst_start <= moment_utc < dst_end:
        return standard_offset + 1
    return standard_offset


def _to_local(moment_utc, facility):
    offset = _local_offset_hours(moment_utc, facility["tz_offset_hours"])
    return moment_utc.astimezone(timezone(timedelta(hours=offset)))


def _seasonal_cosine(doy, peak_doy=200):
    """+1 near mid-July, −1 near mid-January."""
    return math.cos(2 * math.pi * (doy - peak_doy) / 365.25)


def _occupied_kw(facility, hour, weekday):
    """Smooth daytime plateau with cosine ramps at the shift edges."""
    start = facility["occupied_start"]
    end = facility["occupied_end"]
    low = facility["base_night_kw"]
    high = facility["base_day_kw"]
    ramp = 1.25
    if end >= 24.0:
        midpoint = (low + high) / 2.0
        amplitude = (high - low) / 2.0
        load = midpoint + amplitude * math.cos(2 * math.pi * (hour - 15.0) / 24.0)
    elif start <= hour <= end:
        edge = min(hour - start, end - hour, ramp)
        blend = 0.5 - 0.5 * math.cos(math.pi * min(1.0, max(0.0, edge / ramp)))
        load = low + (high - low) * blend
    else:
        load = low
    if weekday >= 5:
        load = low + (load - low) * facility["weekend_factor"]
    return load


def _outdoor_temperature(facility, moment, anomaly):
    doy = moment.timetuple().tm_yday
    hour = _hour_fraction(moment)
    seasonal = facility["seasonal_amp"] * _seasonal_cosine(doy)
    diurnal = facility["diurnal_amp"] * math.cos(2 * math.pi * (hour - 15.0) / 24.0)
    temperature = facility["mean_c"] + seasonal + diurnal + anomaly
    return min(45.0, max(-30.0, temperature))


def _humidity(facility, moment, anomaly, rng):
    doy = moment.timetuple().tm_yday
    hour = _hour_fraction(moment)
    seasonal = 6.0 * math.cos(2 * math.pi * (doy - 15) / 365.25)
    diurnal = 8.0 * math.cos(2 * math.pi * (hour - 6.0) / 24.0)
    humidity = facility["humidity_mean"] + seasonal + diurnal - 1.4 * anomaly + rng.gauss(0, 1.8)
    return min(98.0, max(18.0, humidity))


def _wind_speed(facility, moment, rng):
    doy = moment.timetuple().tm_yday
    hour = _hour_fraction(moment)
    seasonal = 1.0 - 0.18 * _seasonal_cosine(doy)
    diurnal = 1.08 if 11.0 <= hour <= 18.0 else 0.92
    mean = facility["wind_mean"] * seasonal * diurnal
    sigma = mean / math.sqrt(math.pi / 2.0)
    draw = max(1e-9, rng.random())
    return min(28.0, sigma * math.sqrt(-2.0 * math.log(draw)))


def _hvac_kw(facility, temperature_c):
    cooling = facility["cool_kw_per_c"] * max(0.0, temperature_c - facility["cool_balance_c"])
    heating = facility["heat_kw_per_c"] * max(0.0, facility["heat_balance_c"] - temperature_c)
    return cooling + heating


def _solar_hour(facility, local):
    """Clock hour corrected to solar time using longitude and the civil offset."""
    hour = _hour_fraction(local)
    offset = local.utcoffset().total_seconds() / 3600.0
    dst = offset - facility["tz_offset_hours"]
    meridian = facility["tz_offset_hours"] * 15.0
    return hour - dst + (facility["longitude"] - meridian) / 15.0


def _solar_elevation_deg(latitude, doy, hour):
    declination = math.radians(23.44 * math.sin(2 * math.pi * (284 + doy) / 365.25))
    lat = math.radians(latitude)
    hour_angle = math.radians(15.0 * (hour - 12.0))
    sin_elev = math.sin(lat) * math.sin(declination) + math.cos(lat) * math.cos(declination) * math.cos(hour_angle)
    sin_elev = min(1.0, max(-1.0, sin_elev))
    return math.degrees(math.asin(sin_elev))


def _solar_generation_kw(facility, local, humidity, rng):
    capacity = facility["solar_capacity_kw"]
    if capacity <= 0:
        return 0.0
    elevation = _solar_elevation_deg(facility["latitude"], local.timetuple().tm_yday, _solar_hour(facility, local))
    if elevation <= 0.0:
        return 0.0
    sin_elev = math.sin(math.radians(elevation))
    cloud = (humidity - 42.0) / 70.0 + rng.gauss(0, 0.04)
    cloud = min(0.92, max(0.0, cloud))
    return max(0.0, capacity * sin_elev * (1.0 - 0.82 * cloud))


def _iter_timestamps(start, end):
    moment = start
    while moment < end:
        yield moment
        moment += STEP


def _facility_readings(facility, start, end, seed):
    rng = random.Random(seed + facility["id"] * 997)
    anomaly = 0.0
    actual_by_time = {}
    rows = []
    warmup = start - LAG
    for moment in _iter_timestamps(warmup, end):
        if moment.minute == 0 and moment.hour % 3 == 0:
            anomaly = 0.86 * anomaly + rng.gauss(0, 1.7)
        else:
            anomaly = 0.94 * anomaly + rng.gauss(0, 0.18)

        local = _to_local(moment, facility)
        temperature = _outdoor_temperature(facility, local, anomaly)
        humidity = _humidity(facility, local, anomaly, rng)
        wind = _wind_speed(facility, local, rng)
        base = _occupied_kw(facility, _hour_fraction(local), local.weekday())
        expected = base + _hvac_kw(facility, temperature)
        actual = max(0.0, expected + rng.gauss(0, facility["noise_frac"] * expected))
        actual_by_time[moment] = actual

        if moment < start:
            continue

        previous = actual_by_time[moment - LAG]
        rows.append(
            {
                "timestamp": moment.isoformat(),
                "facility_id": facility["id"],
                "temperature_c": round(temperature, 1),
                "humidity_pct": round(humidity, 1),
                "wind_speed_ms": round(wind, 2),
                "previous_hour_demand_kw": round(previous, 2),
                "actual_demand_kw": round(actual, 2),
                "solar_generation_kw": round(_solar_generation_kw(facility, local, humidity, rng), 2),
            }
        )
        actual_by_time.pop(moment - LAG - STEP, None)
    return rows


def generate_dataset(start=START, end=END, seed=SEED):
    """Return 30-minute readings for every facility in ``[start, end)``."""
    rows = []
    for facility in FACILITIES:
        rows.extend(_facility_readings(facility, start, end, seed))
    rows.sort(key=lambda row: (row["timestamp"], row["facility_id"]))
    return pd.DataFrame(rows, columns=COLUMNS)


def export_dataset(frame=None, path=None):
    """Write the telemetry DataFrame to CSV.

    Generates the dataset when ``frame`` is omitted. Returns the written path.
    """
    if frame is None:
        frame = generate_dataset()
    destination = Path(path) if path is not None else DEFAULT_CSV
    destination.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(destination, index=False)
    print(f"Wrote {len(frame)} readings to {destination}")
    return destination


if __name__ == "__main__":
    export_dataset()

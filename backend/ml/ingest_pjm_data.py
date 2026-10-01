"""Build facility telemetry from real PJM hourly load.

PJM zone files (``AEP_hourly.csv``, ``DUQ_hourly.csv``, and the other
``*_hourly.csv`` extracts) contain a timestamp and a megawatt load. This
script reads those files from the workspace or from ``archive.zip``, keeps
six zones, and writes them as the six GreenGrid facilities.

Demand is the published hourly load, scaled from each zone's megawatts onto
that facility's design load so the Django forecast API still speaks in kW.
Weather and on-site solar are not in the PJM files. They are synthesized
from each site's climate and coordinates, with the same rules as
``generate_smart_meter_data.py``. ``previous_hour_demand_kw`` is the prior
clock hour of scaled demand.

The written schema is exactly::

    timestamp, facility_id, temperature_c, humidity_pct, wind_speed_ms,
    previous_hour_demand_kw, actual_demand_kw, solar_generation_kw

Run from the repository root::

    python backend/ml/ingest_pjm_data.py
"""

from __future__ import annotations

import os
import random
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.request import urlretrieve

import pandas as pd

from generate_smart_meter_data import (
    COLUMNS,
    DEFAULT_CSV,
    FACILITIES,
    SEED,
    _humidity,
    _outdoor_temperature,
    _solar_generation_kw,
    _to_local,
    _wind_speed,
)

# PJM publishes these stamps as Eastern Standard Time (fixed UTC-5), including
# the repeated fall-back hour. They are not America/New_York civil time.
EST = timezone(timedelta(hours=-5))
WINDOW_START = datetime(2016, 11, 1, 0, 0)
WINDOW_END = datetime(2018, 8, 3, 0, 0)
MIN_ROWS = 50_000
MAX_ROWS = 100_000

# Six zones with coverage across the window, one per facility id.
ZONE_FILES = {
    1: "DUQ_hourly.csv",
    2: "AEP_hourly.csv",
    3: "DAYTON_hourly.csv",
    4: "DOM_hourly.csv",
    5: "DEOK_hourly.csv",
    6: "FE_hourly.csv",
}

RAW_BASE = "https://raw.githubusercontent.com/drwiiche/electricity-consumption/master"

WORKSPACE = Path(__file__).resolve().parents[2]
SEARCH_DIRS = (
    WORKSPACE,
    WORKSPACE / "backend" / "ml" / "data",
    WORKSPACE / "backend" / "ml" / "data" / "raw",
)


def _archive_candidates():
    env = os.environ.get("PJM_ARCHIVE")
    paths = []
    if env:
        paths.append(Path(env))
    paths.extend(
        [
            WORKSPACE / "archive.zip",
            WORKSPACE / "backend" / "ml" / "data" / "archive.zip",
            Path.home() / "Downloads" / "archive.zip",
        ]
    )
    return [path for path in paths if path.is_file()]


def _find_csv(name):
    for directory in SEARCH_DIRS:
        candidate = directory / name
        if candidate.is_file():
            return candidate
    return None


def _download_csv(name, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    url = f"{RAW_BASE}/{name}"
    print(f"Downloading {url}")
    urlretrieve(url, destination)
    return destination


def _open_zone(name):
    """Return a DataFrame and a short description of where it came from."""
    csv_path = _find_csv(name)
    if csv_path is not None:
        return pd.read_csv(csv_path), str(csv_path)

    for archive in _archive_candidates():
        with zipfile.ZipFile(archive) as bundle:
            member = next((item for item in bundle.namelist() if item.endswith(name)), None)
            if member is None:
                continue
            frame = pd.read_csv(bundle.open(member))
            return frame, f"{archive}::{member}"

    downloaded = _download_csv(name, WORKSPACE / "backend" / "ml" / "data" / "raw" / name)
    return pd.read_csv(downloaded), str(downloaded)


def _target_mean_kw(facility):
    """Facility-scale center of the zone series, in kW."""
    return (facility["base_day_kw"] + facility["base_night_kw"]) / 2.0


def _hourly_load(frame):
    """Collapse a PJM extract to one EST timestamp and one MW value."""
    if "Datetime" not in frame.columns:
        raise ValueError("PJM extract is missing the Datetime column.")
    value_col = next(column for column in frame.columns if column != "Datetime")
    load = frame[["Datetime", value_col]].copy()
    load["Datetime"] = pd.to_datetime(load["Datetime"])
    load = load.groupby("Datetime", as_index=False)[value_col].mean()
    load = load.sort_values("Datetime")
    window = load[
        (load["Datetime"] >= WINDOW_START) & (load["Datetime"] <= WINDOW_END)
    ].copy()
    window["timestamp"] = window["Datetime"].dt.tz_localize(EST).dt.tz_convert("UTC")
    window["mw"] = window[value_col].astype(float)
    return window[["timestamp", "mw"]].reset_index(drop=True)


def _scale_to_facility(load, facility):
    """Keep the zone's hourly shape and express it as facility kW."""
    mean_mw = float(load["mw"].mean())
    if mean_mw <= 0:
        raise ValueError(f"Zone load for facility {facility['id']} has a non-positive mean.")
    scaled = load.copy()
    scaled["actual_demand_kw"] = (scaled["mw"] / mean_mw) * _target_mean_kw(facility)
    scaled["actual_demand_kw"] = scaled["actual_demand_kw"].clip(lower=0.0)
    scaled["previous_hour_demand_kw"] = scaled["actual_demand_kw"].shift(1)
    elapsed_seconds = scaled["timestamp"].diff().dt.total_seconds()
    scaled = scaled[elapsed_seconds == 3600].copy()
    return scaled.reset_index(drop=True)


def _attach_weather(frame, facility):
    """Site climate and solar for each UTC hour. Demand is left unchanged."""
    rng = random.Random(SEED + facility["id"] * 997)
    anomaly = 0.0
    temperature = []
    humidity = []
    wind = []
    solar = []
    for moment in frame["timestamp"]:
        moment = moment.to_pydatetime()
        if moment.minute == 0 and moment.hour % 3 == 0:
            anomaly = 0.86 * anomaly + rng.gauss(0, 1.7)
        else:
            anomaly = 0.94 * anomaly + rng.gauss(0, 0.18)
        local = _to_local(moment, facility)
        dry_bulb = _outdoor_temperature(facility, local, anomaly)
        relative = _humidity(facility, local, anomaly, rng)
        temperature.append(round(dry_bulb, 1))
        humidity.append(round(relative, 1))
        wind.append(round(_wind_speed(facility, local, rng), 2))
        solar.append(round(_solar_generation_kw(facility, local, relative, rng), 2))

    prepared = frame.copy()
    prepared["facility_id"] = facility["id"]
    prepared["temperature_c"] = temperature
    prepared["humidity_pct"] = humidity
    prepared["wind_speed_ms"] = wind
    prepared["solar_generation_kw"] = solar
    prepared["previous_hour_demand_kw"] = prepared["previous_hour_demand_kw"].round(2)
    prepared["actual_demand_kw"] = prepared["actual_demand_kw"].round(2)
    prepared["timestamp"] = prepared["timestamp"].map(lambda stamp: stamp.isoformat())
    return prepared[COLUMNS]


def _trim_to_budget(parts):
    """Keep every facility, and stay inside the 50k–100k row budget."""
    total = sum(len(part) for part in parts)
    if total <= MAX_ROWS:
        return parts
    keep = MAX_ROWS // len(parts)
    return [part.iloc[-keep:].reset_index(drop=True) for part in parts]


def build_telemetry():
    by_id = {facility["id"]: facility for facility in FACILITIES}
    parts = []
    sources = []
    for facility_id, filename in ZONE_FILES.items():
        raw, source = _open_zone(filename)
        facility = by_id[facility_id]
        scaled = _scale_to_facility(_hourly_load(raw), facility)
        parts.append(_attach_weather(scaled, facility))
        sources.append((facility, filename, source, len(parts[-1])))

    parts = _trim_to_budget(parts)
    frame = pd.concat(parts, ignore_index=True)
    frame = frame.sort_values(["timestamp", "facility_id"]).reset_index(drop=True)
    if len(frame) < MIN_ROWS:
        raise RuntimeError(
            f"PJM window produced {len(frame)} rows, below the {MIN_ROWS} minimum. "
            "Widen WINDOW_START."
        )
    return frame[COLUMNS], sources


def export_telemetry(path=None):
    frame, sources = build_telemetry()
    destination = Path(path) if path is not None else DEFAULT_CSV
    destination.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(destination, index=False)
    print(f"Wrote {len(frame)} readings to {destination}")
    print(f"Window {WINDOW_START:%Y-%m-%d} to {WINDOW_END:%Y-%m-%d} EST")
    for facility, filename, source, count in sources:
        print(f"  {facility['id']} {facility['name']:<14} {filename:<18} rows={count:6d}  {source}")
    return destination


if __name__ == "__main__":
    export_telemetry()

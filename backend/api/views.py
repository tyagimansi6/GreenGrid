"""Live six-hour demand forecast from the saved energy model."""

from __future__ import annotations

import math
from functools import lru_cache
from pathlib import Path

from django.conf import settings
from rest_framework.response import Response
from rest_framework.views import APIView

HORIZON_HOURS = 6
FEATURE_COLUMNS = [
    "facility_id",
    "temperature_c",
    "humidity_pct",
    "wind_speed_ms",
    "previous_hour_demand_kw",
    "solar_generation_kw",
    "hour",
    "day_of_week",
    "month",
]
REQUIRED = [
    "temperature_c",
    "humidity_pct",
    "wind_speed_ms",
    "previous_hour_demand_kw",
    "hour",
    "day_of_week",
    "month",
]

# Same sites and solar capacities as backend/ml/generate_smart_meter_data.py.
FACILITIES = {
    1: {"name": "Harborview", "solar_capacity_kw": 200.0},
    2: {"name": "Northwind", "solar_capacity_kw": 0.0},
    3: {"name": "Civic Center", "solar_capacity_kw": 860.0},
    4: {"name": "Lakeside", "solar_capacity_kw": 260.0},
    5: {"name": "Meridian", "solar_capacity_kw": 150.0},
    6: {"name": "Riverside", "solar_capacity_kw": 420.0},
}


def artifact_path():
    return Path(settings.BASE_DIR) / "ml" / "artifacts" / "energy_forecast_model.pkl"


@lru_cache(maxsize=1)
def load_forecast_model():
    """Unpickle the forecast once per process."""
    import joblib

    path = artifact_path()
    if not path.is_file():
        raise FileNotFoundError(f"No model artifact at {path}")
    artifact = joblib.load(path)
    if isinstance(artifact, dict):
        estimator = artifact["estimator"]
        features = list(artifact.get("feature_columns", FEATURE_COLUMNS))
    else:
        estimator = artifact
        features = FEATURE_COLUMNS
    return estimator, features


def _daylight(hour):
    clock = hour % 24.0
    if clock <= 6.0 or clock >= 19.0:
        return 0.0
    return math.sin(math.pi * (clock - 6.0) / 13.0)


def _solar_kw(capacity, reported, origin_hour, hour):
    if capacity <= 0:
        return 0.0
    shape = _daylight(hour)
    origin = _daylight(origin_hour)
    if reported is not None and origin > 0.05:
        return max(0.0, reported * shape / origin)
    return max(0.0, capacity * shape)


def _advance(hour, day_of_week):
    hour += 1.0
    if hour >= 24.0:
        hour -= 24.0
        day_of_week = (day_of_week + 1) % 7
    return hour, day_of_week


def build_forecast(facility_id, telemetry, estimator, features):
    """Roll the one-step model forward one hour at a time."""
    profile = FACILITIES[facility_id]
    origin_hour = telemetry["hour"]
    hour = origin_hour
    day_of_week = telemetry["day_of_week"]
    month = telemetry["month"]
    previous = telemetry["previous_hour_demand_kw"]
    import pandas as pd

    reported_solar = telemetry.get("solar_generation_kw")
    points = []
    for step in range(1, HORIZON_HOURS + 1):
        solar = _solar_kw(profile["solar_capacity_kw"], reported_solar, origin_hour, hour)
        row = pd.DataFrame(
            [
                {
                    "facility_id": facility_id,
                    "temperature_c": telemetry["temperature_c"],
                    "humidity_pct": telemetry["humidity_pct"],
                    "wind_speed_ms": telemetry["wind_speed_ms"],
                    "previous_hour_demand_kw": previous,
                    "solar_generation_kw": solar,
                    "hour": hour,
                    "day_of_week": day_of_week,
                    "month": month,
                }
            ]
        )
        demand = max(0.0, float(estimator.predict(row[features])[0]))
        points.append(
            {
                "hour_ahead": step,
                "hour": round(hour, 2),
                "day_of_week": day_of_week,
                "month": month,
                "solar_generation_kw": round(solar, 2),
                "demand_kw": round(demand, 2),
            }
        )
        previous = demand
        hour, day_of_week = _advance(hour, day_of_week)
    model_step = estimator.named_steps.get("model") if hasattr(estimator, "named_steps") else estimator
    return {
        "facility_id": facility_id,
        "facility": profile["name"],
        "solar_capacity_kw": profile["solar_capacity_kw"],
        "model": type(model_step).__name__,
        "horizon_hours": HORIZON_HOURS,
        "forecast": points,
    }


def _parse_telemetry(data, facility_id):
    errors = {}
    if "facility_id" in data and str(data.get("facility_id")) not in {"", "None"}:
        try:
            if int(data.get("facility_id")) != facility_id:
                errors["facility_id"] = "facility_id does not match the URL."
        except (TypeError, ValueError):
            errors["facility_id"] = "facility_id must be an integer."

    parsed = {}
    for field in REQUIRED:
        raw = data.get(field)
        if raw is None or raw == "":
            errors[field] = "This field is required."
            continue
        try:
            parsed[field] = float(raw)
        except (TypeError, ValueError):
            errors[field] = "A number is required."

    solar_raw = data.get("solar_generation_kw")
    if solar_raw not in (None, ""):
        try:
            parsed["solar_generation_kw"] = float(solar_raw)
        except (TypeError, ValueError):
            errors["solar_generation_kw"] = "A number is required."

    if errors:
        return None, errors

    parsed["day_of_week"] = int(parsed["day_of_week"])
    parsed["month"] = int(parsed["month"])
    if not 0.0 <= parsed["hour"] < 24.0:
        errors["hour"] = "hour must be from 0 up to 24."
    if parsed["day_of_week"] not in range(7):
        errors["day_of_week"] = "day_of_week must be an integer from 0 (Monday) through 6."
    if parsed["month"] not in range(1, 13):
        errors["month"] = "month must be an integer from 1 through 12."
    if not 0.0 <= parsed["humidity_pct"] <= 100.0:
        errors["humidity_pct"] = "humidity_pct must be between 0 and 100."
    if parsed["wind_speed_ms"] < 0:
        errors["wind_speed_ms"] = "wind_speed_ms cannot be negative."
    if parsed["previous_hour_demand_kw"] < 0:
        errors["previous_hour_demand_kw"] = "previous_hour_demand_kw cannot be negative."
    if parsed.get("solar_generation_kw", 0) < 0:
        errors["solar_generation_kw"] = "solar_generation_kw cannot be negative."
    if not -40.0 <= parsed["temperature_c"] <= 55.0:
        errors["temperature_c"] = "temperature_c must be between -40 and 55."
    if errors:
        return None, errors
    return parsed, None


class FacilityForecastView(APIView):
    """Forecast the next six hours of facility demand from current telemetry."""

    def get(self, request, facility_id):
        return self._forecast(request.query_params, facility_id)

    def post(self, request, facility_id):
        return self._forecast(request.data, facility_id)

    def _forecast(self, data, facility_id):
        if facility_id not in FACILITIES:
            return Response({"detail": "No facility matches that id."}, status=404)
        telemetry, errors = _parse_telemetry(data, facility_id)
        if errors:
            return Response(errors, status=400)
        try:
            estimator, features = load_forecast_model()
            payload = build_forecast(facility_id, telemetry, estimator, features)
        except Exception as exc:
            return Response({"detail": f"Forecast model is unavailable: {exc}"}, status=503)
        return Response(payload)

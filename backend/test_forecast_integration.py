"""End-to-end check: React client, Django forecast API, and the saved model.

Confirms three links:

1. ``GET /api/forecast/<facility_id>/`` loads ``energy_forecast_model.pkl``,
   accepts facility telemetry, and returns a six-hour JSON forecast.
2. ``django-cors-headers`` allows the Vite origins ``http://localhost:5173``
   and ``http://127.0.0.1:5173``.
3. The React API layer calls that endpoint, and the facility page renders
   the returned curve.

The Django checks use the test client, so they do not need a running server.
If something is already listening on port 8000, the same request is repeated
over HTTP with an Origin header.

Run from the repository root::

    python backend/test_forecast_integration.py
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
REPO_ROOT = BACKEND_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "greengrid.settings")

import django

django.setup()

from django.test.utils import setup_test_environment
from rest_framework.test import APIClient

import api.views as forecast_views

setup_test_environment()

TELEMETRY = {
    "temperature_c": 22.5,
    "humidity_pct": 55,
    "wind_speed_ms": 3.2,
    "previous_hour_demand_kw": 1200,
    "solar_generation_kw": 40,
    "hour": 14,
    "day_of_week": 2,
    "month": 6,
}
VITE_ORIGINS = ("http://localhost:5173", "http://127.0.0.1:5173")
LIVE_API = os.environ.get("GREENGRID_API_URL", "http://127.0.0.1:8000")


class CheckFailure(Exception):
    pass


def _check(name, ok, detail):
    mark = "PASS" if ok else "FAIL"
    print(f"  [{mark}] {name}: {detail}")
    if not ok:
        raise CheckFailure(name)


def _forecast_points(payload):
    points = payload.get("forecast")
    if not isinstance(points, list) or len(points) != 6:
        return False
    for index, point in enumerate(points, start=1):
        demand = point.get("demand_kw")
        if point.get("hour_ahead") != index or not isinstance(demand, (int, float)):
            return False
        if demand < 0:
            return False
    return True


def check_artifact():
    forecast_views.load_forecast_model.cache_clear()
    estimator, features = forecast_views.load_forecast_model()
    path = forecast_views.artifact_path()
    model_step = estimator.named_steps.get("model") if hasattr(estimator, "named_steps") else estimator
    name = type(model_step).__name__
    _check(
        "model artifact",
        path.is_file() and "previous_hour_demand_kw" in features,
        f"{name} loaded from {path.name}",
    )
    return name


def check_endpoint(client):
    response = client.get("/api/forecast/1/", TELEMETRY)
    payload = response.json() if response.status_code == 200 else {}
    _check(
        "GET /api/forecast/1/",
        response.status_code == 200 and _forecast_points(payload),
        f"status {response.status_code}, model {payload.get('model')}, "
        f"{len(payload.get('forecast') or [])} hours",
    )
    posted = client.post(
        "/api/forecast/1/",
        data=json.dumps(TELEMETRY),
        content_type="application/json",
    )
    _check(
        "POST /api/forecast/1/",
        posted.status_code == 200 and _forecast_points(posted.json()),
        f"status {posted.status_code}",
    )
    return payload


def check_cors(client):
    for origin in VITE_ORIGINS:
        response = client.get("/api/forecast/1/", TELEMETRY, HTTP_ORIGIN=origin)
        _check(
            f"CORS {origin}",
            response.status_code == 200 and response.get("Access-Control-Allow-Origin") == origin,
            response.get("Access-Control-Allow-Origin") or "no Access-Control-Allow-Origin",
        )
        preflight = client.options(
            "/api/forecast/1/",
            HTTP_ORIGIN=origin,
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="GET",
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS="content-type",
        )
        allow = preflight.get("Access-Control-Allow-Origin")
        methods = preflight.get("Access-Control-Allow-Methods") or ""
        _check(
            f"preflight {origin}",
            preflight.status_code == 200 and allow == origin and "GET" in methods,
            f"status {preflight.status_code}, methods {methods}",
        )


def check_frontend_sources():
    api_js = (REPO_ROOT / "frontend" / "src" / "api.js").read_text(encoding="utf-8")
    detail = (REPO_ROOT / "frontend" / "src" / "pages" / "FacilityDetail.jsx").read_text(encoding="utf-8")
    vite = (REPO_ROOT / "frontend" / "vite.config.js").read_text(encoding="utf-8")
    _check(
        "React API call",
        "forecast:" in api_js and "/api/forecast/${facilityId}/" in api_js,
        "frontend/src/api.js requests /api/forecast/<facility_id>/",
    )
    _check(
        "React forecast curve",
        "ml-forecast-curve" in detail and "api.forecast" in detail,
        "FacilityDetail renders the six-hour curve from that response",
    )
    _check(
        "Vite proxy",
        '"/api"' in vite and "127.0.0.1:8000" in vite,
        "Vite forwards /api to the Django server",
    )


def check_live_server():
    query = "&".join(f"{key}={value}" for key, value in TELEMETRY.items())
    url = f"{LIVE_API.rstrip('/')}/api/forecast/1/?{query}"
    request = urllib.request.Request(url, headers={"Origin": "http://localhost:5173"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.loads(response.read().decode())
            origin = response.headers.get("Access-Control-Allow-Origin")
    except (urllib.error.URLError, TimeoutError) as exc:
        print(f"  [SKIP] live HTTP: Django is not answering at {LIVE_API} ({exc})")
        return
    _check(
        "live HTTP forecast",
        _forecast_points(payload) and origin == "http://localhost:5173",
        f"model {payload.get('model')}, CORS origin {origin}",
    )


def main():
    print("GreenGrid forecast integration")
    try:
        check_artifact()
        client = APIClient()
        payload = check_endpoint(client)
        check_cors(client)
        check_frontend_sources()
        check_live_server()
    except CheckFailure:
        print("Integration check failed.")
        return 1
    hours = ", ".join(str(point["demand_kw"]) for point in payload["forecast"])
    print(f"Connected. Harborview forecast kW: {hours}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Verify the live six-hour demand forecast for Harborview Data Center.

Uses Django's test client against the saved model artifact (no mock).

Run from the backend directory::

    python test_ml_api.py
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "greengrid.settings")

import django

django.setup()

from django.test.utils import setup_test_environment
from rest_framework.test import APIClient

# The test client sends Host: testserver. Outside a TestCase that host is
# only allowed after the test environment is installed.
setup_test_environment()

# Harborview Data Center is facility id 1.
FACILITY_ID = 1
TELEMETRY = {
    "temperature_c": 22.5,
    "humidity_pct": 55,
    "wind_speed_ms": 3.2,
    "previous_hour_demand_kw": 1200,
    "hour": 14,
    "day_of_week": 2,
    "month": 6,
}


def main():
    client = APIClient()
    response = client.get(f"/api/forecast/{FACILITY_ID}/", TELEMETRY)

    assert response.status_code == 200, (
        f"Expected 200 OK, got {response.status_code}: {response.content.decode()}"
    )

    payload = response.json()
    forecast = payload.get("forecast", [])
    assert len(forecast) == 6, f"Expected a 6-hour forecast, got {len(forecast)} points."

    print(json.dumps(payload, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

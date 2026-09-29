import json
from datetime import datetime, timedelta

from django.test import TestCase

from energy.ml.forecast import forecast_demand
from energy.seed import seed_demo
from energy.services import classify


class ClassifyTests(TestCase):
    def test_boundaries(self):
        self.assertEqual(classify(79, 100, 0.8, 0.95)[0], "normal")
        self.assertEqual(classify(80, 100, 0.8, 0.95)[0], "warning")
        self.assertEqual(classify(94.9, 100, 0.8, 0.95)[0], "warning")
        self.assertEqual(classify(95, 100, 0.8, 0.95)[0], "critical")
        self.assertEqual(classify(110, 100, 0.8, 0.95)[0], "critical")


class ForecastTests(TestCase):
    def test_returns_non_negative_steps(self):
        start = datetime(2026, 9, 21, 0, 0)
        times = [start + timedelta(hours=step) for step in range(48)]
        demands = [100 + 20 * ((step % 24) / 24) for step in range(48)]
        forecast = forecast_demand(times, demands, steps=6)
        self.assertEqual(len(forecast), 6)
        self.assertTrue(all(value >= 0 for value in forecast))


class ApiTests(TestCase):
    def setUp(self):
        seed_demo(reset=True)

    def test_dashboard_status_mix(self):
        response = self.client.get("/api/dashboard/")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["kpis"]["facility_count"], 6)
        statuses = {site["status"] for site in payload["facilities"]}
        self.assertIn("critical", statuses)
        self.assertIn("warning", statuses)
        self.assertIn("normal", statuses)
        self.assertGreater(payload["kpis"]["penalty_7d"], 0)

    def test_billing_explains_window(self):
        response = self.client.get("/api/billing/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["window_days"], 7)
        self.assertEqual(len(response.json()["sites"]), 6)

    def test_alerts_and_renewables(self):
        alerts = self.client.get("/api/alerts/")
        renewables = self.client.get("/api/renewables/")
        self.assertEqual(alerts.status_code, 200)
        self.assertGreater(len(alerts.json()["alerts"]), 0)
        self.assertEqual(renewables.status_code, 200)
        self.assertGreater(renewables.json()["capacity_kw"], 0)
        civic = next(site for site in renewables.json()["sites"] if site["code"] == "CIVIC")
        self.assertGreater(civic["export_kwh"], 0)

    def test_reject_inverted_thresholds(self):
        response = self.client.patch(
            "/api/facilities/HARBOR/",
            data=json.dumps({"warning_ratio": 0.99, "critical_ratio": 0.5}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_update_limit(self):
        response = self.client.patch(
            "/api/facilities/MERID/",
            data=json.dumps({"contracted_limit_kw": 1100}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["facility"]["contracted_limit_kw"], 1100)

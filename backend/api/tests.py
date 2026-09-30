import api.views as views
from django.test import TestCase

from api.views import FEATURE_COLUMNS


class _EchoModel:
    def predict(self, frame):
        return frame["previous_hour_demand_kw"].to_numpy() + 10.0


class ForecastApiTests(TestCase):
    def setUp(self):
        self.real_loader = views.load_forecast_model
        views.load_forecast_model = lambda: (_EchoModel(), FEATURE_COLUMNS)
        self.addCleanup(self._restore)

    def _restore(self):
        views.load_forecast_model = self.real_loader

    def _query(self, **extra):
        params = {
            "temperature_c": 30,
            "humidity_pct": 55,
            "wind_speed_ms": 3.1,
            "previous_hour_demand_kw": 3300,
            "hour": 15,
            "day_of_week": 1,
            "month": 6,
        }
        params.update(extra)
        return params

    def test_get_returns_six_hours(self):
        response = self.client.get("/api/forecast/2/", self._query())
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["facility"], "Northwind")
        self.assertEqual(payload["solar_capacity_kw"], 0)
        self.assertEqual(len(payload["forecast"]), 6)
        self.assertEqual(payload["forecast"][0]["demand_kw"], 3310.0)
        self.assertEqual(payload["forecast"][5]["hour_ahead"], 6)
        self.assertEqual(payload["forecast"][5]["hour"], 20.0)
        self.assertTrue(all(point["solar_generation_kw"] == 0 for point in payload["forecast"]))

    def test_post_and_cors(self):
        response = self.client.post(
            "/api/forecast/1/",
            data=self._query(solar_generation_kw=80),
            content_type="application/json",
            HTTP_ORIGIN="http://localhost:5173",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Access-Control-Allow-Origin"], "http://localhost:5173")
        self.assertEqual(len(response.json()["forecast"]), 6)
        self.assertGreater(response.json()["forecast"][0]["solar_generation_kw"], 0)

        preflight = self.client.options(
            "/api/forecast/1/",
            HTTP_ORIGIN="http://localhost:5173",
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS="content-type",
        )
        self.assertEqual(preflight.status_code, 200)
        self.assertIn("POST", preflight["Access-Control-Allow-Methods"])

    def test_missing_fields_and_unknown_facility(self):
        missing = self.client.get("/api/forecast/1/")
        self.assertEqual(missing.status_code, 400)
        self.assertIn("temperature_c", missing.json())
        unknown = self.client.get("/api/forecast/9/", self._query())
        self.assertEqual(unknown.status_code, 404)

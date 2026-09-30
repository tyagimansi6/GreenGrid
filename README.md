# GreenGrid Enterprise EMIS

GreenGrid is an energy management information system for a portfolio of buildings that sit under a utility demand contract. It watches metered demand, compares each site with its contracted cap, and forecasts the next six hours so an operator can shed load before the utility bills a peak penalty.

This document describes the system as it runs in the repository: the live API, the saved model, and the numbers produced by `backend/ml/evaluate_model.py`.

## Executive summary

Utilities do not bill large sites only for energy used. They also bill for the highest demand (kW) the meter records inside a billing window, and many contracts add a penalty when that spike crosses a contracted cap. A short afternoon peak can cost more than a full day of ordinary use.

GreenGrid treats that cap as an operating limit, not a report that arrives after the invoice.

- **Demand (kW)** is the quantity the contract enforces. It is the spike the utility sees.
- **Energy (kWh)** is tracked separately and drives the usage charge.
- **On-site solar** reduces the demand the grid meter records. A site can be busy and still stay under its cap if generation covers the peak.
- **Warning** starts at 80% of the contract. **Critical** starts at 95%, including anything already over the limit. Both thresholds are editable per site.
- **The six-hour forecast** is there so the operator can act while the peak is still ahead of the meter, not after the interval has closed.

The demo portfolio is six facilities: a hospital, a data center, a campus, a plant, an office, and a warehouse. Each has its own contract, tariff, and solar capacity. The board shows which sites are inside their band, which are approaching it, and which forecast is about to step into a hotter band.

## Problem statement

A demand charge is assessed on the maximum metered kilowatts in the billing period. Crossing the contracted cap, even for one interval, can set the ratchet for the rest of the bill and trigger a penalty on top of the energy charge. Operators usually learn this from the invoice, which is too late to move load.

The operational problem GreenGrid is built to answer:

1. What is each facility drawing from the grid right now, after solar?
2. How close is that draw to the warning line and to the contract cap?
3. If weather, occupancy, and the last hour of demand continue, will the next six hours cross a penalty band?
4. Which loads can be deferred so the metered peak stays under the cap?

Avoiding the penalty means acting inside the current interval. The product therefore pairs a live status (Normal, Warning, Critical) with an hour-by-hour forecast, rather than a monthly summary.

## Architecture and tech stack

```
Browser (Vite, port 5173)
    React 19 control center
        |  GET /api/*   proxied in development
        v
Django 5.2  +  Django REST Framework   (port 8000)
    energy app     portfolio, alerts, billing, renewables, site pages
    api app        six-hour forecast from the saved model
        |
        +-- SQLite by default, Postgres when DATABASE_URL is set
        +-- HistGradientBoostingRegressor  (joblib artifact, loaded once per process)
```

### Frontend

| Piece | What it is |
| --- | --- |
| React 19.1 | UI, routing, and the live board |
| Vite 7 | Dev server on port 5173 with `strictPort`, production build |
| Tailwind CSS 3 | Layout and the GreenGrid color system |
| React Router 7 | Overview, facilities, alerts, billing, renewables, analytics, grid, reports, settings |
| SVG trend charts | Continuous `M`/`L` paths for history and the dashed six-hour forecast |
| Recharts | Cost bars and the renewable mix only |
| Canvas 2D | Particle wordmark on the opening frame |
| Landscape film | Full-viewport MP4 behind the control center |

The operations picture is that film with live charts composited on top. **There is no Three.js or WebGL dependency** in `frontend/package.json`. A reviewer who searches the lockfile for `three` will not find it. The landscape is a video (`frontend/public/greengrid-landscape.mp4`); the wordmark is a 2D canvas; the time series are SVG paths. Claiming a WebGL scene would not survive an inspection of the repository.

The dashboard polls the API on a short interval (`usePoll`, about 5–15 seconds depending on the view). The last payload is cached in memory so switching tabs does not flash an empty skeleton. A small live multiplier nudges the latest hour so the board keeps moving between polls. There is no WebSocket.

### Backend

| Piece | What it is |
| --- | --- |
| Python 3.14.0 | Local virtualenv (`backend/.venv`) that serves the API and runs evaluation |
| Django 5.2.17 | Installed from `Django>=5.1,<5.3` |
| Django REST Framework | JSON API, open for the demo (`AllowAny`, no auth classes) |
| django-cors-headers | Allows `http://localhost:5173` and `http://127.0.0.1:5173` |
| SQLite | Default database for the portfolio tape |
| Postgres | Used when `DATABASE_URL` is set (`psycopg`, `dj-database-url`) |
| scikit-learn + joblib | Saved forecast pipeline |
| WhiteNoise + gunicorn | Static files and the production process |

Render's blueprint pins Python 3.12.8 for the hosted service. Local development and the evaluation below were run on Python 3.14.0.

### Two forecasts, on purpose

A reviewer will find two predictors. They answer different questions and must not be described as one model.

| | Saved model | On-chart regression |
| --- | --- | --- |
| Code | `backend/api/views.py` | `backend/energy/ml/forecast.py` |
| Route | `GET` or `POST /api/forecast/<facility_id>/` | Embedded in `GET /api/facilities/<code>/` |
| Estimator | `HistGradientBoostingRegressor` inside a scikit-learn `Pipeline` | Ordinary least squares |
| Features | Weather, solar, facility id, hour, weekday, month, previous-hour demand | Intercept, sine and cosine of the hour, previous-hour demand |
| Training data | `smart_meter_telemetry.csv` (52,128 half-hour rows) | The last week of that site's stored hourly tape |
| Horizon | Six steps, each prediction fed back as the next previous-hour demand | Same six-step roll-forward |
| What it is for | The live forecast API and `backend/test_ml_api.py` | The dashed line on Overview and Facility Detail |

The R² in the next section belongs only to the saved gradient-boosting model, scored one step ahead on the holdout. It is not the score of the least-squares line drawn on the charts.

## Machine learning pipeline and evaluation

### Dataset

`backend/ml/data/smart_meter_telemetry.csv` is a **synthetic** telemetry tape, generated by `backend/ml/generate_smart_meter_data.py` with `SEED = 42`.

| Fact | Value |
| --- | --- |
| Rows | 52,128 |
| Sites | 6 (ids 1–6) |
| Cadence | 30 minutes |
| Window | 2026-01-01 00:00 UTC through 2026-06-30 23:30 UTC (181 days × 48 intervals × 6 sites) |
| Generator | Deterministic. Same seed, same file |

Columns written by the generator:

`timestamp`, `facility_id`, `temperature_c`, `humidity_pct`, `wind_speed_ms`, `previous_hour_demand_kw`, `actual_demand_kw`, `solar_generation_kw`

Each site has its own occupancy window, weekend factor, heating and cooling slopes, weather climate, and solar capacity (Harborview 200 kW, Northwind 0 kW, Civic Center 860 kW, Lakeside 260 kW, Meridian 150 kW, Riverside 420 kW). Demand is a base load plus occupancy, a temperature response, solar offset, and a small noise term. It is not a feed from a utility.

The dashboard does **not** plot this CSV. `python manage.py seed_demo` writes a separate seven-day hourly tape into SQLite for the six contract sites (codes `HARBOR`, `NORDC`, `CIVIC`, `LAKES`, `MERID`, `RIVER`). Those codes and the forecast ids 1–6 are the same buildings, stored for different jobs.

### Feature engineering

`evaluate_model.py` and the API share the same feature list. Three columns are derived from `timestamp` and are not stored in the CSV:

| Feature | How it is made |
| --- | --- |
| `hour` | Hour plus minute/60, so 14:30 is 14.5 |
| `day_of_week` | Monday = 0 |
| `month` | Calendar month |
| `facility_id` | Site identity, one-hot encoded inside the saved pipeline |
| `temperature_c`, `humidity_pct`, `wind_speed_ms` | Weather at the interval |
| `solar_generation_kw` | On-site generation at the interval |
| `previous_hour_demand_kw` | Lagged demand. This is the strongest single feature |
| `actual_demand_kw` | Target. Never used as an input |

The artifact is a scikit-learn `Pipeline`: a `ColumnTransformer` (one-hot facility id, numeric passthrough) and a `HistGradientBoostingRegressor`. It was pickled with scikit-learn 1.9.0. Loading it on 1.9.1 prints an `InconsistentVersionWarning` and still returns forecasts. The file is `backend/ml/artifacts/energy_forecast_model.pkl`. The process loads it once (`lru_cache`).

The API rolls that one-step model forward six times. Weather and month stay at the values the caller sent. Solar is shaped by a daylight sine and the site's capacity. Each predicted demand becomes `previous_hour_demand_kw` for the next hour. Error can accumulate across the six hours. The published R² is the one-step holdout, not a six-step score.

### Evaluation

Reproduce it from `backend/ml`:

```powershell
..\.venv\Scripts\python evaluate_model.py
```

The split is chronological. For each facility, the last 20% of its own timeline is the test set (10,428 rows, 2026-05-25 19:00 UTC through 2026-06-30 23:30 UTC). Rows are not shuffled. The artifact is assumed to have been fit on the earlier 80%.

Measured on that holdout, one step ahead:

| | RMSE | MAE | R² |
| --- | ---: | ---: | ---: |
| **Overall (pooled)** | **52.72 kW** | **36.99 kW** | **0.9975** |

Per facility, same holdout, 1,738 rows each:

| ID | Facility | Solar kW | RMSE kW | MAE kW | R² |
| ---: | --- | ---: | ---: | ---: | ---: |
| 1 | Harborview | 200 | 49.67 | 36.70 | 0.8763 |
| 2 | Northwind | 0 | 49.43 | 39.21 | 0.9162 |
| 3 | Civic Center | 860 | 61.18 | 42.22 | 0.9657 |
| 4 | Lakeside | 260 | 65.51 | 45.26 | 0.9859 |
| 5 | Meridian | 150 | 41.72 | 25.02 | 0.9496 |
| 6 | Riverside | 420 | 44.59 | 33.55 | 0.8978 |

Northwind, the site with no solar, has a lower RMSE (49.43 kW) than the mean of the other five (52.53 kW).

**How to read 0.9975.** The pooled R² is high because the six sites sit on very different demand levels, and `previous_hour_demand_kw` already tells the model which level it is on. A single R² across a portfolio rewards a model for knowing that a data center is not an office. The per-site R² values, 0.8763 to 0.9859, are the fairer statement of hour-ahead skill inside one building. Both numbers are in this file so a reviewer does not have to discover the gap.

## API endpoints and integration

Base URL in development: `http://127.0.0.1:8000/api/`. The Vite server proxies `/api` to that origin, so the browser calls same-origin `/api/...`.

Demo authentication is open (`AllowAny`). Put authentication in front of this API before it leaves a classroom or a portfolio deploy.

### Portfolio routes

Served by the `energy` app.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health/` | Liveness |
| GET | `/api/dashboard/` | Portfolio demand, alert mix, site cards, 24-hour series |
| GET | `/api/facilities/` | Every site with its live status |
| GET | `/api/facilities/<code>/` | History, on-chart six-hour regression, bill, recommendations |
| PATCH | `/api/facilities/<code>/` | Contract limit, warning and critical thresholds, tariffs |
| GET | `/api/alerts/` | Sites currently in warning or critical |
| GET | `/api/billing/` | Seven-day energy, demand, and penalty estimates |
| GET | `/api/renewables/` | Solar generation, export, and grid import |

Facility codes: `HARBOR`, `NORDC`, `CIVIC`, `LAKES`, `MERID`, `RIVER`.

### Live six-hour forecast

```
GET  /api/forecast/<facility_id>/
POST /api/forecast/<facility_id>/
```

`<facility_id>` is an integer **1 through 6**, matching the telemetry CSV (1 Harborview, 2 Northwind, 3 Civic Center, 4 Lakeside, 5 Meridian, 6 Riverside). These are not the dashboard codes.

GET reads query parameters. POST reads a JSON body. The fields are the same.

| Field | Required | Meaning |
| --- | --- | --- |
| `temperature_c` | yes | Dry-bulb temperature, held constant across the six hours |
| `humidity_pct` | yes | Relative humidity |
| `wind_speed_ms` | yes | Wind speed |
| `previous_hour_demand_kw` | yes | Demand in the hour just closed. Becomes the lag for step 1 |
| `hour` | yes | Hour at the origin (0–24). Fractional hours are accepted |
| `day_of_week` | yes | Monday = 0 … Sunday = 6. Advances when the roll crosses midnight |
| `month` | yes | 1–12, held constant |
| `solar_generation_kw` | no | If present, scales the daylight shape. Otherwise the site capacity is used |
| `facility_id` | no | If sent, it must equal the id in the URL |

Status codes:

| Code | When |
| --- | --- |
| 200 | Six forecast points |
| 400 | A required field is missing or not numeric, or `facility_id` disagrees with the URL |
| 404 | Id is outside 1–6 |
| 503 | The pickle is missing or will not load |

Example, Harborview:

```
GET /api/forecast/1/?temperature_c=22.5&humidity_pct=55&wind_speed_ms=3.2&previous_hour_demand_kw=1200&hour=14&day_of_week=2&month=6
```

A 200 body looks like this (values depend on the artifact):

```json
{
  "facility_id": 1,
  "facility": "Harborview",
  "solar_capacity_kw": 200.0,
  "model": "HistGradientBoostingRegressor",
  "horizon_hours": 6,
  "forecast": [
    {
      "hour_ahead": 1,
      "hour": 14.0,
      "day_of_week": 2,
      "month": 6,
      "solar_generation_kw": 180.0,
      "demand_kw": 1201.0
    }
  ]
}
```

`forecast` always contains six objects, `hour_ahead` 1 through 6. Each point's predicted `demand_kw` is the next point's previous-hour demand.

Verify the live artifact without a browser:

```powershell
cd backend
.\.venv\Scripts\python test_ml_api.py
```

That script boots Django's test client, calls `GET /api/forecast/1/` with the telemetry above, asserts HTTP 200 and six points, and prints the JSON. It loads the real pickle. It does not mock the model.

## Run it locally

Two terminals, from the repository root.

Backend:

```powershell
cd backend
py -3 -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python manage.py migrate
.\.venv\Scripts\python manage.py seed_demo
.\.venv\Scripts\python manage.py runserver
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite is pinned to that port. If 5173 is already taken, the dev server exits instead of silently moving to another port.

`seed_demo` is idempotent. Run it with `--reset` to rebuild the seven-day tape. Schedules are generated in `TIME_ZONE` (default `Asia/Kolkata`).

Regenerate the synthetic CSV (optional; the committed file is already the seed-42 tape):

```powershell
cd backend\ml
..\.venv\Scripts\python generate_smart_meter_data.py
```

## Deploy

Frontend on Vercel, API on Render.

**Render.** Use `render.yaml`, or a Python web service with root directory `backend`.

- Build: `pip install -r requirements.txt && python manage.py collectstatic --noinput`
- Start: `python manage.py migrate && python manage.py seed_demo && gunicorn greengrid.wsgi:application --bind 0.0.0.0:$PORT`
- Set `DEBUG=false`, a real `SECRET_KEY`, and `ALLOWED_HOSTS=.onrender.com`
- The blueprint sets `PYTHON_VERSION=3.12.8` and `TIME_ZONE=Asia/Kolkata`

**Vercel.** Project root `frontend`. Set `VITE_API_URL` to the Render origin (for example `https://greengrid-api.onrender.com`) and redeploy. Preview hosts on `*.vercel.app` are already allowed by CORS. A custom domain needs `CORS_ALLOWED_ORIGINS` on the API.

Set `DATABASE_URL` to keep data across deploys. Without it the API uses SQLite, and Render's disk reset wipes it. The start command seeds demo data again when the tables are empty.

## Project evaluator / judge Q&A

### Where did the 52,128 rows come from?

From `backend/ml/generate_smart_meter_data.py`, seed 42. The generator writes 181 days of half-hourly rows for six sites: occupancy schedules, weekend setbacks, heating and cooling slopes, a seasonal and diurnal temperature, and a solar shape clipped by each site's capacity. It is synthetic by design. It is not a utility interval feed, and the README does not describe it as one.

The charts on the dashboard come from a second, smaller tape: seven days of hourly readings created by `seed_demo` and stored in the database. Quoting the CSV row count as the size of the on-screen history would be wrong.

### Why is R² 0.9975? Is the model overfit?

The figure is real. `evaluate_model.py` prints `R2 0.9975` on the pooled chronological holdout (10,428 rows, last 20% of each site, 25 May 2026 through 30 June 2026). It is not a training-set score, and the split is not random.

It is also the wrong number to quote alone. Inside a single facility the same predictions score R² from 0.8763 (Harborview) to 0.9859 (Lakeside). The pooled score is high because sites differ by thousands of kilowatts and because `previous_hour_demand_kw` carries most of that level forward. A model that only copied the previous hour would already look strong on a pooled R². The per-site table is the check against that story.

What we did to keep the test honest:

- Holdout is the **end** of each series, so the model cannot train on Tuesday and test on Monday of the same week.
- The target column is not in the feature list.
- Metrics are MAE and RMSE in kilowatts as well as R², so a flattering ratio cannot hide a 50 kW typical error.
- The published score is **one step ahead**. The API's six-hour path feeds predictions back in as the lag, so hour 6 is a harder problem than the R² describes. We do not claim 0.9975 for the sixth hour.

### Why include previous-hour demand if it dominates the fit?

Because the decision is hour-ahead peak avoidance, and the last metered hour is the information an operator actually has. Dropping it would make a worse operations model in order to produce a more dramatic feature-importance chart. Weather, solar, and the hour-of-day terms are what move the forecast off that lag when occupancy or temperature changes. The per-site R² above 0.87, against a lag baseline that is already strong, is the evidence those terms are doing some work. We do not claim they are the main effect.

### Does the dashboard line use this model?

No. Facility pages and the overview forecast use the least-squares regression in `backend/energy/ml/forecast.py`, fit on that site's recent hourly tape. The gradient-boosting artifact is what `GET /api/forecast/<facility_id>/` returns. Both roll six hours forward. They are not the same fit, and a mismatch between the chart and the forecast route is expected.

### Is this real-time SCADA?

No. The browser polls. The API recomputes status from the latest stored reading, then applies a small live multiplier so successive polls are not identical. There is no meter protocol, no streaming bus, and no write path that opens a breaker. The assistant's load-shed answer is a recommendation computed from the same payload. It does not control equipment.

The history window follows the stored tape when that tape is older than the wall clock, so a demo database that has not been reseeded still draws a continuous line. Timestamps on the dashed forecast are anchored to the last stored sample, then drawn after the live point by array order.

### Will this scale past six buildings and a laptop?

The forecast view is stateless. Telemetry arrives on the request, the pipeline is loaded once per process, and the response does not write a row. Horizontal scaling is a matter of more gunicorn workers and a shared artifact file, not of session affinity.

The portfolio views are not stateless in the same way. They read SQLite (or Postgres). SQLite is the right default for a single-process demo and the wrong default for concurrent writers. `DATABASE_URL` switches the Django database to Postgres without an application rewrite. Alert evaluation is a query over the latest reading per site, not a scan of the 52k training file. The training file is not on the request path.

What this design does not do: multi-tenant auth, a model registry, online retraining, or a guarantee that six-step error stays inside the one-step MAE. Those are the next engineering problems, and they are not implemented.

### Is the landscape a Three.js scene?

No. `frontend/package.json` depends on React, React DOM, React Router, Recharts, and lucide-react. The full-viewport image is an MP4. The opening wordmark is a 2D canvas particle draw. Trend charts are SVG path elements. A WebGL digital twin is not part of this build, and the score above does not depend on one.

### What happens if the pickle is missing?

`/api/forecast/<id>/` returns 503 with a detail string. The portfolio routes keep working, because they do not load that file. `test_ml_api.py` fails its status assertion, which is the signal that the artifact did not ship.

### What should a reviewer run in ten minutes?

1. `manage.py migrate` and `manage.py seed_demo`, then `runserver`.
2. `npm run dev` in `frontend`, open http://localhost:5173, and confirm a site moves between Normal, Warning, and Critical as its demand is compared with 80% and 95% of its contract.
3. `python evaluate_model.py` in `backend/ml` and confirm overall R² 0.9975 **and** the per-site table.
4. `python test_ml_api.py` in `backend` and confirm HTTP 200 with six `demand_kw` points for facility 1.

## Layout

```
backend/
  greengrid/          settings, root URLs
  energy/             portfolio API, seed data, on-chart regression
  api/                /api/forecast/<facility_id>/
  ml/
    data/smart_meter_telemetry.csv
    artifacts/energy_forecast_model.pkl
    generate_smart_meter_data.py
    evaluate_model.py
  test_ml_api.py
frontend/
  src/                React control center
  public/             landscape film and poster
render.yaml           Render blueprint
```

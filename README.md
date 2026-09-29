# GreenGrid

Energy management for buildings that live under a utility contract limit. GreenGrid reads demand from each facility, compares it with that limit, and marks the site **Normal**, **Warning**, or **Critical** before a penalty or a local overload lands.

The contract is enforced on **metered demand (kW)** — the spike the utility bills. **Energy (kWh)** is tracked separately and drives the usage charge. On-site solar lowers the demand the grid actually sees.

## Alert rules

Defaults, editable per site:

| State | Rule |
| --- | --- |
| Normal | Metered demand is under the warning line (80% of the contract) |
| Warning | Demand has reached the warning line and is still under the critical line |
| Critical | Demand has reached 95% of the contract, including anything over the limit |

A small regression forecasts the next six hours from the hour of day and the previous hour's demand. Facility pages use that forecast to say whether the site is about to step into a hotter band.

## Run it locally

From PowerShell, in two terminals.

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

Open http://localhost:5173. The dev server proxies `/api` to Django on port 8000.

`seed_demo` loads six facilities and seven days of hourly readings. Run it again with `--reset` to rebuild that data. Live numbers wobble slightly around the latest hour so the board keeps moving.

Demo schedules are generated in `TIME_ZONE` (default `Asia/Kolkata`), so the daily shape matches local afternoon and evening.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health/` | Liveness |
| GET | `/api/dashboard/` | Portfolio demand, alert mix, site cards |
| GET | `/api/facilities/` | Every site with its live status |
| GET | `/api/facilities/<code>/` | History, forecast, bill, recommendations |
| PATCH | `/api/facilities/<code>/` | Update the contract limit, thresholds, and tariffs |
| GET | `/api/alerts/` | Sites currently in warning or critical |
| GET | `/api/billing/` | Seven-day energy, demand, and penalty estimates |
| GET | `/api/renewables/` | Solar generation, export, and grid import |

The demo API is open so the dashboard can be reviewed immediately. Add authentication before exposing it beyond a class or portfolio deploy.

## Deploy

Frontend on Vercel, API on Render.

**Render.** Use the `render.yaml` at the repo root, or create a Python web service with root directory `backend`:

- Build: `pip install -r requirements.txt && python manage.py collectstatic --noinput`
- Start: `python manage.py migrate && python manage.py seed_demo && gunicorn greengrid.wsgi:application --bind 0.0.0.0:$PORT`
- Set `DEBUG=false`, a real `SECRET_KEY`, and `ALLOWED_HOSTS=.onrender.com`

**Vercel.** Import the repo and set the project root to `frontend`. Add `VITE_API_URL` as the Render origin, for example `https://greengrid-api.onrender.com`, then redeploy. Preview URLs on `*.vercel.app` are already allowed by the API's CORS rules. For a custom domain, set `CORS_ALLOWED_ORIGINS` on Render.

Optional: set `DATABASE_URL` to a Postgres instance. Without it, the API uses SQLite, which resets when Render recycles the disk. The start command seeds demo data again when the tables are empty.

## Layout

```
backend/     Django + Django REST Framework
  energy/    facilities, readings, alert rules, billing, forecast
frontend/    React, Vite, Tailwind CSS, Recharts
render.yaml  Render service definition
```

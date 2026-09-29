"""Evaluate the saved energy-demand forecast on a chronological holdout.

The test split is the last 20% of each facility's timeline in
``smart_meter_telemetry.csv``. The model artifact is expected to have been
fit on the earlier 80%.

Run from the repository root::

    python backend/ml/evaluate_model.py
"""

from __future__ import annotations

from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from generate_smart_meter_data import FACILITIES

ARTIFACT_PATH = Path(__file__).resolve().parent / "artifacts" / "energy_forecast_model.pkl"
DATA_PATH = Path(__file__).resolve().parent / "data" / "smart_meter_telemetry.csv"
TEST_FRACTION = 0.2
TARGET = "actual_demand_kw"
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


def add_time_features(frame):
    timestamps = pd.to_datetime(frame["timestamp"], utc=True)
    prepared = frame.copy()
    prepared["hour"] = timestamps.dt.hour + timestamps.dt.minute / 60.0
    prepared["day_of_week"] = timestamps.dt.dayofweek
    prepared["month"] = timestamps.dt.month
    return prepared


def load_telemetry(path=DATA_PATH):
    frame = pd.read_csv(path)
    frame = add_time_features(frame)
    return frame.sort_values(["facility_id", "timestamp"]).reset_index(drop=True)


def chronological_split(frame, test_fraction=TEST_FRACTION):
    """Hold out the last ``test_fraction`` of each facility, in time order."""
    train_parts = []
    test_parts = []
    for _, group in frame.groupby("facility_id", sort=True):
        group = group.sort_values("timestamp")
        cut = int(len(group) * (1.0 - test_fraction))
        cut = min(max(cut, 1), len(group) - 1)
        train_parts.append(group.iloc[:cut])
        test_parts.append(group.iloc[cut:])
    train = pd.concat(train_parts, ignore_index=True)
    test = pd.concat(test_parts, ignore_index=True)
    return train, test


def load_test_split(path=DATA_PATH):
    _, test = chronological_split(load_telemetry(path))
    return test


def load_model(path=ARTIFACT_PATH):
    if not path.is_file():
        raise FileNotFoundError(f"No model artifact at {path}")
    artifact = joblib.load(path)
    if isinstance(artifact, dict):
        estimator = artifact["estimator"]
        features = list(artifact.get("feature_columns", FEATURE_COLUMNS))
        target = artifact.get("target", TARGET)
        return estimator, features, target
    return artifact, FEATURE_COLUMNS, TARGET


def regression_metrics(y_true, y_pred):
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    residual_sq = mean_squared_error(y_true, y_pred)
    return {
        "rmse": float(np.sqrt(residual_sq)),
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "r2": float(r2_score(y_true, y_pred)),
    }


def facility_breakdown(test, y_pred):
    scored = test.copy()
    scored["prediction_kw"] = y_pred
    lookup = {item["id"]: item for item in FACILITIES}
    rows = []
    for facility_id, group in scored.groupby("facility_id", sort=True):
        profile = lookup[int(facility_id)]
        metrics = regression_metrics(group[TARGET], group["prediction_kw"])
        rows.append(
            {
                "facility_id": int(facility_id),
                "name": profile["name"],
                "solar_capacity_kw": profile["solar_capacity_kw"],
                "n": int(len(group)),
                **metrics,
            }
        )
    return rows


def _model_name(estimator):
    if hasattr(estimator, "named_steps") and "model" in estimator.named_steps:
        return type(estimator.named_steps["model"]).__name__
    return type(estimator).__name__


def print_report(estimator, test, overall, breakdown):
    start = pd.to_datetime(test["timestamp"], utc=True).min()
    end = pd.to_datetime(test["timestamp"], utc=True).max()
    print("Energy forecast evaluation")
    print(f"Model     {_model_name(estimator)}")
    print(f"Artifact  {ARTIFACT_PATH}")
    print(f"Test rows {len(test):,}  ({TEST_FRACTION:.0%} chronological holdout per facility)")
    print(f"Window    {start:%Y-%m-%d %H:%M} UTC  to  {end:%Y-%m-%d %H:%M} UTC")
    print()
    print("Overall")
    print(f"  RMSE  {overall['rmse']:8.2f} kW")
    print(f"  MAE   {overall['mae']:8.2f} kW")
    print(f"  R2    {overall['r2']:8.4f}")
    print()
    print("Facility breakdown")
    header = f"  {'ID':>2}  {'Facility':<14}  {'Solar kW':>8}  {'n':>6}  {'RMSE':>8}  {'MAE':>8}  {'R2':>8}"
    print(header)
    print(f"  {'-' * (len(header) - 2)}")
    for row in breakdown:
        print(
            f"  {row['facility_id']:>2}  {row['name']:<14}  {row['solar_capacity_kw']:8.0f}  "
            f"{row['n']:6d}  {row['rmse']:8.2f}  {row['mae']:8.2f}  {row['r2']:8.4f}"
        )

    northwind = next(row for row in breakdown if row["name"] == "Northwind")
    others = [row["rmse"] for row in breakdown if row["name"] != "Northwind"]
    other_rmse = float(np.mean(others))
    relation = "higher" if northwind["rmse"] > other_rmse else "lower"
    print()
    print(
        f"Northwind (0 kW solar) RMSE is {relation} than the mean of the other sites "
        f"({northwind['rmse']:.2f} kW vs {other_rmse:.2f} kW)."
    )


def main():
    estimator, features, target = load_model()
    test = load_test_split()
    predictions = estimator.predict(test[features])
    overall = regression_metrics(test[target], predictions)
    breakdown = facility_breakdown(test, predictions)
    print_report(estimator, test, overall, breakdown)


if __name__ == "__main__":
    main()

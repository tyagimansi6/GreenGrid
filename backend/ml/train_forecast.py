"""Train the facility demand model and write the forecast artifact.

The fit uses the earlier 80% of each facility in
``smart_meter_telemetry.csv``. The last 20% is a chronological holdout, the
same split ``evaluate_model.py`` scores. Holdout rows are not noised.

Hour-ahead demand is almost a copy of the previous hour, so an unconstrained
tree scores above 0.99. Depth, leaf size, and a short boosting run keep the
fit from copying that lag. Training rows also get a small meter and weather
disturbance so the trees are not fit to exact sensor values. The holdout
target is left unchanged.

Both a ``HistGradientBoostingRegressor`` and a ``RandomForestRegressor`` are
fit on that training slice. The gradient-boosting pipeline is the artifact
the Django forecast API loads.

Run from the repository root::

    python backend/ml/train_forecast.py
"""

from __future__ import annotations

import joblib
import numpy as np
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from evaluate_model import (
    ARTIFACT_PATH,
    FEATURE_COLUMNS,
    TARGET,
    TEST_FRACTION,
    chronological_split,
    load_telemetry,
)

NUMERIC = [column for column in FEATURE_COLUMNS if column != "facility_id"]
NOISE_SEED = 42

# Shallow trees. HistGradientBoosting has no min_samples_split; leaf size is
# its split control. The forest uses both knobs.
BOOSTING_PARAMS = {
    "learning_rate": 0.07,
    "max_depth": 5,
    "max_iter": 16,
    "min_samples_leaf": 500,
    "l2_regularization": 10.0,
    "early_stopping": False,
    "random_state": NOISE_SEED,
}
FOREST_PARAMS = {
    "n_estimators": 80,
    "max_depth": 4,
    "min_samples_split": 8000,
    "min_samples_leaf": 4000,
    "max_features": 0.45,
    "n_jobs": -1,
    "random_state": NOISE_SEED,
}


def build_pipeline(estimator):
    preprocessor = ColumnTransformer(
        transformers=[
            (
                "facility",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                ["facility_id"],
            ),
            ("num", "passthrough", NUMERIC),
        ]
    )
    return Pipeline(steps=[("prep", preprocessor), ("model", estimator)])


def _training_view(frame, rng):
    """Copy of the training rows with meter, weather, and target noise.

    The disturbance is applied only while fitting. Evaluation uses the
    original holdout features and the recorded demand.
    """
    noisy = frame.copy()
    count = len(noisy)
    noisy["temperature_c"] = noisy["temperature_c"] + rng.normal(0.0, 1.0, count)
    noisy["humidity_pct"] = np.clip(noisy["humidity_pct"] + rng.normal(0.0, 3.0, count), 0.0, 100.0)
    noisy["wind_speed_ms"] = np.clip(noisy["wind_speed_ms"] + rng.normal(0.0, 0.4, count), 0.0, None)
    lag = noisy["previous_hour_demand_kw"].to_numpy(dtype=float)
    lag_noise = rng.normal(0.0, 0.04, count) * np.maximum(lag, 1.0)
    noisy["previous_hour_demand_kw"] = np.clip(lag + lag_noise, 0.0, None)
    noisy["solar_generation_kw"] = np.clip(
        noisy["solar_generation_kw"] + rng.normal(0.0, 6.0, count),
        0.0,
        None,
    )
    demand = frame[TARGET].to_numpy(dtype=float)
    target_noise = rng.normal(0.0, 0.03, count) * np.maximum(demand, 1.0)
    return noisy, np.clip(demand + target_noise, 0.0, None)


def _metrics(y_true, y_pred):
    residual_sq = mean_squared_error(y_true, y_pred)
    return {
        "rmse": float(np.sqrt(residual_sq)),
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "r2": float(r2_score(y_true, y_pred)),
    }


def _report(name, scores):
    print(
        f"  {name:<32}  RMSE {scores['rmse']:8.2f} kW"
        f"   MAE {scores['mae']:8.2f} kW   R2 {scores['r2']:8.4f}"
    )


def train():
    frame = load_telemetry()
    train_frame, test_frame = chronological_split(frame, TEST_FRACTION)
    features = FEATURE_COLUMNS
    y_test = test_frame[TARGET]
    noisy_train, y_train = _training_view(train_frame, np.random.default_rng(NOISE_SEED))

    boosting = build_pipeline(HistGradientBoostingRegressor(**BOOSTING_PARAMS))
    forest = build_pipeline(RandomForestRegressor(**FOREST_PARAMS))

    print(f"Training rows {len(train_frame):,}   holdout rows {len(test_frame):,}")
    boosting.fit(noisy_train[features], y_train)
    forest.fit(noisy_train[features], y_train)

    boosting_scores = _metrics(y_test, boosting.predict(test_frame[features]))
    forest_scores = _metrics(y_test, forest.predict(test_frame[features]))
    print("Holdout, one step ahead")
    _report("HistGradientBoostingRegressor", boosting_scores)
    _report("RandomForestRegressor", forest_scores)

    ARTIFACT_PATH.parent.mkdir(parents=True, exist_ok=True)
    artifact = {
        "estimator": boosting,
        "feature_columns": list(features),
        "target": TARGET,
        "test_fraction": TEST_FRACTION,
        "split": "chronological_per_facility",
    }
    joblib.dump(artifact, ARTIFACT_PATH)
    print(f"Saved HistGradientBoostingRegressor pipeline to {ARTIFACT_PATH}")
    return boosting_scores


if __name__ == "__main__":
    train()

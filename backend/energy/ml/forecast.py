"""Hour-ahead demand model.

Fits a least-squares regression on the last week of metered grid demand.
Features are an intercept, the sine and cosine of the hour, and the previous
hour's demand. That is enough to follow each building's daily shape without
pretending a heavier model is required for this horizon.
"""

from __future__ import annotations

import math

import numpy as np


def _hour_fraction(moment):
    return moment.hour + moment.minute / 60.0


def _row(hour, previous):
    angle = 2 * math.pi * hour / 24.0
    return np.array([1.0, math.sin(angle), math.cos(angle), previous], dtype=float)


def forecast_demand(times, demands, steps=6):
    """Return `steps` non-negative demand forecasts after the last sample."""
    values = [float(value) for value in demands]
    if not values:
        return [0.0] * steps
    if len(values) < 24 or len(times) != len(values):
        return [values[-1]] * steps

    hours = np.array([_hour_fraction(moment) for moment in times], dtype=float)
    target = np.array(values, dtype=float)
    lagged = np.roll(target, 1)
    lagged[0] = target[0]
    features = np.column_stack(
        [
            np.ones(len(target)),
            np.sin(2 * math.pi * hours / 24.0),
            np.cos(2 * math.pi * hours / 24.0),
            lagged,
        ]
    )
    coefficients, *_ = np.linalg.lstsq(features, target, rcond=None)
    ceiling = max(target) * 1.35 + 1.0

    last_value = float(target[-1])
    last_time = times[-1]
    forecasts = []
    for step in range(1, steps + 1):
        hour = (_hour_fraction(last_time) + step) % 24.0
        prediction = float(_row(hour, last_value) @ coefficients)
        prediction = min(max(0.0, prediction), ceiling)
        forecasts.append(prediction)
        last_value = prediction
    return forecasts

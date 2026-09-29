from django.db import models


class Facility(models.Model):
    """A building or site with a utility contract demand limit."""

    name = models.CharField(max_length=140)
    code = models.CharField(max_length=16, unique=True)
    location = models.CharField(max_length=160)
    facility_type = models.CharField(max_length=40)
    contracted_limit_kw = models.FloatField()
    warning_ratio = models.FloatField(default=0.80)
    critical_ratio = models.FloatField(default=0.95)
    rate_per_kwh = models.DecimalField(max_digits=8, decimal_places=4)
    demand_rate_per_kw = models.DecimalField(max_digits=8, decimal_places=2)
    penalty_per_kw = models.DecimalField(max_digits=8, decimal_places=2)
    solar_capacity_kw = models.FloatField(default=0)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.code} · {self.name}"


class Reading(models.Model):
    """One hour of metered load, on-site solar, and grid import."""

    facility = models.ForeignKey(Facility, related_name="readings", on_delete=models.CASCADE)
    recorded_at = models.DateTimeField(db_index=True)
    load_kw = models.FloatField()
    solar_kw = models.FloatField()
    grid_kw = models.FloatField()
    load_kwh = models.FloatField()
    solar_kwh = models.FloatField()
    grid_kwh = models.FloatField()
    export_kwh = models.FloatField(default=0)

    class Meta:
        ordering = ["recorded_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["facility", "recorded_at"],
                name="unique_reading_at",
            )
        ]

    def __str__(self):
        return f"{self.facility.code} @ {self.recorded_at:%Y-%m-%d %H:%M}"

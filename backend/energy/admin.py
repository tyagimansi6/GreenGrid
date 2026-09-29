from django.contrib import admin

from energy.models import Facility, Reading


@admin.register(Facility)
class FacilityAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "name",
        "facility_type",
        "location",
        "contracted_limit_kw",
        "warning_ratio",
        "critical_ratio",
        "solar_capacity_kw",
    )
    search_fields = ("name", "code", "location")


@admin.register(Reading)
class ReadingAdmin(admin.ModelAdmin):
    list_display = ("facility", "recorded_at", "grid_kw", "load_kw", "solar_kw", "export_kwh")
    list_filter = ("facility",)
    date_hierarchy = "recorded_at"

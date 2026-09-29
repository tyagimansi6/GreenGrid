from django.urls import path

from energy.views import (
    AlertsView,
    BillingView,
    DashboardView,
    FacilityDetailView,
    FacilityListView,
    HealthView,
    RenewablesView,
)

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("facilities/", FacilityListView.as_view(), name="facilities"),
    path("facilities/<str:code>/", FacilityDetailView.as_view(), name="facility-detail"),
    path("alerts/", AlertsView.as_view(), name="alerts"),
    path("billing/", BillingView.as_view(), name="billing"),
    path("renewables/", RenewablesView.as_view(), name="renewables"),
]

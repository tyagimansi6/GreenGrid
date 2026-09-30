from django.urls import path

from api.views import FacilityForecastView

urlpatterns = [
    path("forecast/<int:facility_id>/", FacilityForecastView.as_view(), name="facility-forecast"),
]

from django.shortcuts import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView

from energy.models import Facility
from energy.serializers import FacilityUpdateSerializer
from energy.services import (
    build_alerts,
    build_billing,
    build_dashboard,
    build_facility_detail,
    build_renewables,
    build_summaries,
)


class HealthView(APIView):
    def get(self, request):
        return Response({"status": "ok", "service": "greengrid"})


class DashboardView(APIView):
    def get(self, request):
        return Response(build_dashboard())


class FacilityListView(APIView):
    def get(self, request):
        return Response({"facilities": build_summaries()})


class FacilityDetailView(APIView):
    def get(self, request, code):
        payload = build_facility_detail(code)
        if payload is None:
            return Response({"detail": "No facility matches that code."}, status=404)
        return Response(payload)

    def patch(self, request, code):
        facility = get_object_or_404(Facility, code__iexact=code)
        serializer = FacilityUpdateSerializer(facility, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(build_facility_detail(facility.code))


class AlertsView(APIView):
    def get(self, request):
        return Response(build_alerts())


class BillingView(APIView):
    def get(self, request):
        return Response(build_billing())


class RenewablesView(APIView):
    def get(self, request):
        return Response(build_renewables())

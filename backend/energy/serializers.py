from rest_framework import serializers

from energy.models import Facility


class FacilityUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Facility
        fields = [
            "contracted_limit_kw",
            "warning_ratio",
            "critical_ratio",
            "rate_per_kwh",
            "demand_rate_per_kw",
            "penalty_per_kw",
        ]

    def validate(self, attrs):
        facility = self.instance
        warning = attrs.get("warning_ratio", facility.warning_ratio)
        critical = attrs.get("critical_ratio", facility.critical_ratio)
        limit = attrs.get("contracted_limit_kw", facility.contracted_limit_kw)
        rate = attrs.get("rate_per_kwh", facility.rate_per_kwh)
        demand_rate = attrs.get("demand_rate_per_kw", facility.demand_rate_per_kw)
        penalty = attrs.get("penalty_per_kw", facility.penalty_per_kw)

        if limit <= 0:
            raise serializers.ValidationError("Contract limit must be greater than zero.")
        if not 0 < warning < critical <= 1:
            raise serializers.ValidationError(
                "Warning must sit below critical, and both must be between 0% and 100% of the contract limit."
            )
        if rate < 0 or demand_rate < 0 or penalty < 0:
            raise serializers.ValidationError("Tariffs and the penalty rate cannot be negative.")
        return attrs

"""Load sample buildings and a week of hourly energy telemetry into MySQL."""

from django.core.management.base import BaseCommand

from energy.models import Facility, Reading
from energy.seed import seed_demo


class Command(BaseCommand):
    help = (
        "Insert sample facilities (buildings, contract baselines, efficiency bands) "
        "and seven days of hourly energy telemetry so the dashboard has live metrics."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Replace existing facilities and telemetry.",
        )

    def handle(self, *args, **options):
        created = seed_demo(reset=options["reset"])
        if not created and not Facility.objects.exists():
            self.stdout.write(self.style.ERROR("No facility rows were written."))
            return

        if not created:
            self.stdout.write(
                "Sample data already exists. Re-run with --reset to rebuild it."
            )

        self.stdout.write(self.style.SUCCESS("GreenGrid sample data is ready."))
        self.stdout.write("")
        self.stdout.write(
            f"{'Code':<8} {'Building':<32} {'Baseline kW':>12} {'Solar kW':>10} {'Warn':>6}"
        )
        for facility in Facility.objects.order_by("code"):
            self.stdout.write(
                f"{facility.code:<8} {facility.name:<32} "
                f"{facility.contracted_limit_kw:>12.0f} "
                f"{facility.solar_capacity_kw:>10.0f} "
                f"{facility.warning_ratio:>6.0%}"
            )
        self.stdout.write("")
        self.stdout.write(
            f"Facilities: {Facility.objects.count()}    "
            f"Telemetry rows: {Reading.objects.count()}"
        )

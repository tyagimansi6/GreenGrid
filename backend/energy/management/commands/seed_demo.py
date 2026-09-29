from django.core.management.base import BaseCommand

from energy.seed import seed_demo


class Command(BaseCommand):
    help = "Load demo facilities and seven days of hourly meter readings."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Replace existing demo facilities and readings.",
        )

    def handle(self, *args, **options):
        created = seed_demo(reset=options["reset"])
        if created:
            self.stdout.write(self.style.SUCCESS("Demo energy data is ready."))
        else:
            self.stdout.write("Demo data already exists. Re-run with --reset to rebuild it.")

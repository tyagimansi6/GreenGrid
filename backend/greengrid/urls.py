from django.contrib import admin
from django.urls import include, path

from greengrid.views import api_root

urlpatterns = [
    path("", api_root, name="api-root"),
    path("admin/", admin.site.urls),
    path("api/", include("energy.urls")),
    path("api/", include("api.urls")),
]

from django.http import JsonResponse


def api_root(request):
    return JsonResponse({
        "status": "online",
        "message": "Welcome to GreenGrid Backend API",
        "admin": "/admin/",
    })

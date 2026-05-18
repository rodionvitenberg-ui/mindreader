from django.urls import path
from .views import ScanUploadView

urlpatterns = [
    # Эндпоинт будет доступен по пути: /api/v1/scan/
    path('scan/', ScanUploadView.as_view(), name='scan_upload'),
]
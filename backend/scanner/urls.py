from django.urls import path
from .views import ScanUploadView, ScanResultView # Добавили импорт

urlpatterns = [
    path('scan/', ScanUploadView.as_view(), name='scan_upload'),
    path('scan/<int:scan_id>/', ScanResultView.as_view(), name='scan_result'), # Добавили роут
]
from django.urls import path
from .views import ScanUploadView, ScanResultView

urlpatterns = [
    # Эндпоинты загрузки (Next.js теперь может слать без слэша)
    path('scan/', ScanUploadView.as_view(), name='scan_upload'),
    path('scan', ScanUploadView.as_view()), # <- Добавили дубль без слэша

    # Эндпоинты пуллинга результатов
    path('scan/<int:scan_id>/', ScanResultView.as_view(), name='scan_result'),
    path('scan/<int:scan_id>', ScanResultView.as_view()), # <- Добавили дубль без слэша
]
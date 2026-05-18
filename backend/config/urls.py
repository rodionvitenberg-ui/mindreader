from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from scanner.views import ScanResultView

urlpatterns = [
    path('admin/', admin.site.urls),
    # Роуты сканера (уже есть)
    path('api/v1/', include('scanner.urls')),
    # Подключаем роуты настроек и пользователей
    path('api/v1/', include('users.urls')),
    path('scan/<int:scan_id>/', ScanResultView.as_view(), name='scan-result'), 
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
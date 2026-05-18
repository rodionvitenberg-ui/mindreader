from django.urls import path
from .views import AppConfigView

urlpatterns = [
    # Эндпоинт будет доступен по пути: /api/v1/config/
    path('config/', AppConfigView.as_view(), name='app_config'),
]
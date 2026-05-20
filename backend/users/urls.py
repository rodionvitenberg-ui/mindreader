from django.urls import path
from .views import AppConfigView
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

app_name = 'users'

urlpatterns = [
    # Эндпоинт будет доступен по пути: /api/v1/config/
    path('config/', AppConfigView.as_view(), name='app_config'),
    # Эндпоинты для работы с JWT токенами
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]
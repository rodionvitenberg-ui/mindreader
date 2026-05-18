from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from .models import SystemSettings

class AppConfigView(APIView):
    """
    Эндпоинт инициализации приложения.
    Отдает фронтенду глобальные лимиты и индивидуальные настройки пользователя.
    """
    # Разрешаем доступ гостям, чтобы камера работала без авторизации
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        # Достаем глобальный дефолт из нашей Singleton-модели
        global_settings = SystemSettings.load()
        frame_limit = global_settings.default_frame_count

        # Если пользователь залогинен и у него есть свой лимит (например, он тестировщик) — переопределяем
        if request.user.is_authenticated and request.user.custom_frame_count is not None:
            frame_limit = request.user.custom_frame_count

        return Response({
            "camera": {
                "frame_limit": frame_limit
            },
            # На будущее: сюда отлично ложатся Feature Toggles (флаги фичей).
            # Например, можно отдавать {"history_enabled": True/False}, 
            # чтобы скрывать экран "История" на время техработ.
            "features": {
                "streaming_analysis": False # Та самая платная фича, о которой мы говорили в начале
            }
        })
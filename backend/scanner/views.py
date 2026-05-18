from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework import status
from django.core.files.storage import default_storage
from django.db import transaction
from django.shortcuts import get_object_or_404 # Добавили импорт
from .models import AnimalScan
from .tasks import process_animal_scan

class ScanUploadView(APIView):
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, *args, **kwargs):
        files = request.FILES.getlist('frames')
        
        if not files:
            return Response({"error": "Images are required."}, status=status.HTTP_400_BAD_REQUEST)
        if len(files) > 3:
            return Response({"error": "Maximum 3 frames allowed."}, status=status.HTTP_400_BAD_REQUEST)

        saved_paths = []
        for file in files:
            file_path = default_storage.save(f'scans/{file.name}', file)
            saved_paths.append(default_storage.url(file_path))

        # БЕЗОПАСНОСТЬ: Привязываем сканирование к пользователю, если он авторизован
        user = request.user if request.user.is_authenticated else None

        scan = AnimalScan.objects.create(
            user=user,
            image_paths=saved_paths,
            status=AnimalScan.ScanStatus.PROCESSING
        )

        transaction.on_commit(lambda: process_animal_scan.delay(scan.id))

        return Response({
            "scan_id": scan.id,
            "status": scan.status,
            "message": "Frames received. AI analysis started."
        }, status=status.HTTP_202_ACCEPTED)


class ScanResultView(APIView):
    """
    Эндпоинт для пуллинга. Фронтенд стучится сюда, пока статус не станет 'completed'.
    """
    def get(self, request, scan_id, *args, **kwargs):
        scan = get_object_or_404(AnimalScan, id=scan_id)

        response_data = {
            "scan_id": scan.id,
            "status": scan.status,
            "created_at": scan.created_at
        }

        if scan.status == AnimalScan.ScanStatus.COMPLETED:
            response_data["analysis"] = scan.ai_analysis
            # Если профиль был определен, отдаем и его ID
            if scan.pet_profile:
                response_data["pet_profile_id"] = scan.pet_profile.id
            return Response(response_data, status=status.HTTP_200_OK)

        elif scan.status == AnimalScan.ScanStatus.FAILED:
            response_data["error"] = "AI analysis failed."
            return Response(response_data, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        else:
            response_data["message"] = "AI is thinking..."
            return Response(response_data, status=status.HTTP_200_OK)
        
class ScanResultView(APIView):
    """
    Polling Endpoint: GET /api/v1/scan/<int:scan_id>/
    Возвращает статус обработки. Если завершено - отдает результаты анализа ИИ.
    """
    def get(self, request, scan_id):
        # Получаем объект или отдаем 404
        scan = get_object_or_404(AnimalScan, id=scan_id)
        
        # Базовый ответ содержит только статус
        data = {
            "status": scan.status
        }
        
        # Если Celery-воркер успешно завершил задачу, добавляем полезную нагрузку
        if scan.status == AnimalScan.ScanStatus.COMPLETED:
            data["ai_analysis"] = scan.ai_analysis
            data["pet_profile_id"] = scan.pet_profile_id
            
        return Response(data)
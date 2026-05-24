from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework import status
from django.http import JsonResponse
from django.views import View
from django.core.files.storage import default_storage
from django.db import transaction
from django.shortcuts import get_object_or_404
from .models import AnimalScan, UserScannerProfile, ScannerLevelConfig
from .tasks import process_animal_scan

class ScanUploadView(APIView):
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, *args, **kwargs):
        files = request.FILES.getlist('frames')
        device_id = request.data.get('device_id')
        
        # ДОБАВЛЕНО: Извлекаем ID сессии
        session_uuid = request.data.get('session_uuid')
        
        if not files:
            return Response({"error": "Images are required."}, status=status.HTTP_400_BAD_REQUEST)
        if len(files) > 3:
            return Response({"error": "Maximum 3 frames allowed."}, status=status.HTTP_400_BAD_REQUEST)
        if not device_id:
            return Response({"error": "device_id parameter is required for gamification."}, status=status.HTTP_400_BAD_REQUEST)

        saved_paths = []
        for file in files:
            file_path = default_storage.save(f'scans/{file.name}', file)
            saved_paths.append(default_storage.url(file_path))

        user_obj = request.user if request.user.is_authenticated else None
        
        if user_obj:
            profile, _ = UserScannerProfile.objects.get_or_create(user=user_obj, defaults={'device_id': device_id})
        else:
            profile, _ = UserScannerProfile.objects.get_or_create(device_id=device_id)

        # ДОБАВЛЕНО: Сохраняем session_uuid в базу
        scan = AnimalScan.objects.create(
            user=user_obj,
            device_id=device_id,
            session_uuid=session_uuid, 
            image_paths=saved_paths,
            status=AnimalScan.ScanStatus.PROCESSING
        )


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
            if scan.pet_profile:
                response_data["pet_profile_id"] = scan.pet_profile.id
            return Response(response_data, status=status.HTTP_200_OK)

        elif scan.status == AnimalScan.ScanStatus.FAILED:
            response_data["error"] = "AI analysis failed."
            return Response(response_data, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        else:
            response_data["message"] = "AI is thinking..."
            return Response(response_data, status=status.HTTP_200_OK)
        

class ScannerProfileView(View):
    """
    GET /api/v1/scanner/profile/?device_id=UUID
    Возвращает текущий уровень, доступные секунды и прогресс опыта.
    """
    def get(self, request, format=None):
        device_id = request.GET.get('device_id')
        if not device_id:
            return JsonResponse({'error': 'Missing device_id parameter'}, status=400)

        user_obj = request.user if request.user.is_authenticated else None
        
        if user_obj:
            profile, _ = UserScannerProfile.objects.get_or_create(user=user_obj, defaults={'device_id': device_id})
        else:
            profile, _ = UserScannerProfile.objects.get_or_create(device_id=device_id)

        current_config = ScannerLevelConfig.objects.filter(level=profile.current_level).first()
        max_seconds = current_config.max_hold_seconds if current_config else 3
        extra_seconds = current_config.extra_time_seconds if current_config else 5
        next_config = ScannerLevelConfig.objects.filter(level=profile.current_level + 1).first()
        
        if next_config:
            scans_to_next_level = next_config.scans_required - profile.total_successful_scans
            total_needed_for_next = next_config.scans_required
        else:
            scans_to_next_level = 0
            total_needed_for_next = profile.total_successful_scans

        payload = {
            'device_id': profile.device_id,
            'current_level': profile.current_level,
            'total_successful_scans': profile.total_successful_scans,
            'max_hold_seconds': max_seconds,
            'extra_time_seconds': extra_seconds, # <--- Отдаем на фронтенд Next.js
            'scans_remaining_to_level_up': max(0, scans_to_next_level),
            'next_level_required_total': total_needed_for_next
        }
        
        return JsonResponse(payload, status=200)
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework import status
from django.core.files.storage import default_storage
from django.db import transaction # Импортируем модуль транзакций
from .models import AnimalScan
from .tasks import process_animal_scan

class ScanUploadView(APIView):
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, *args, **kwargs):
        files = request.FILES.getlist('frames')
        
        if not files:
            return Response(
                {"error": "Images are required. No frames provided."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        if len(files) > 3:
            return Response(
                {"error": "Maximum 3 frames allowed to save API tokens."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        saved_paths = []
        for file in files:
            file_path = default_storage.save(f'scans/{file.name}', file)
            saved_paths.append(default_storage.url(file_path))

        # Создаем запись сразу со статусом PROCESSING
        scan = AnimalScan.objects.create(
            image_paths=saved_paths,
            status=AnimalScan.ScanStatus.PROCESSING
        )

        # Гарантируем, что задача уйдет в Celery ТОЛЬКО после записи в БД
        transaction.on_commit(lambda: process_animal_scan.delay(scan.id))

        return Response({
            "scan_id": scan.id,
            "status": scan.status,
            "message": "Frames received. AI analysis started."
        }, status=status.HTTP_202_ACCEPTED)
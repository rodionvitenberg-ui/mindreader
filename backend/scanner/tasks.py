import os
import base64
import json
from django.conf import settings
from django.core.files.storage import default_storage
from celery import shared_task
from openai import OpenAI
from pgvector.django import CosineDistance # Импортируем функцию измерения расстояния
from .models import AnimalScan, PetProfile, AIPersonality
from .ml_services import get_image_embedding # Наш локальный скрипт для векторов

client = OpenAI(
    api_key=os.environ.get("DEEPSEEK_API_KEY"),
    base_url="https://api.deepseek.com/v1"
)

def encode_image_to_base64(image_url):
    relative_path = image_url.replace(settings.MEDIA_URL, '', 1)
    # Используем default_storage.open вместо open()
    with default_storage.open(relative_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')
    
@shared_task
def process_animal_scan(scan_id):
    try:
        scan = AnimalScan.objects.get(id=scan_id)
        
        # --- ИЗМЕНЕНИЯ ЗДЕСЬ: Читаем через абстракцию хранилища ---
        first_image_url = scan.image_paths[0]
        relative_path = first_image_url.replace(settings.MEDIA_URL, '', 1)
        
        with default_storage.open(relative_path, "rb") as image_file:
            new_vector = get_image_embedding(image_file)
            
        # 2. ИЩЕМ СОВПАДЕНИЯ В БАЗЕ (Тот самый векторный поиск)
        # Ищем профили, где косинусное расстояние < 0.15 (это означает сходство > 85%)
        matched_profile = PetProfile.objects.annotate(
            distance=CosineDistance('face_encoding', new_vector)
        ).filter(distance__lt=0.15).order_by('distance').first()

        # Если не нашли - создаем новый теневой профиль
        if not matched_profile:
            matched_profile = PetProfile.objects.create(
                is_shadow=True,
                name=f"Ghost_Pet_#{scan.id}",
                face_encoding=new_vector
            )
            
        # Привязываем текущий скан к найденному/созданному профилю
        scan.pet_profile = matched_profile
        scan.save(update_fields=['pet_profile'])

        # 3. ФОРМИРУЕМ ЛИЧНОСТЬ И ПАМЯТЬ
        system_base = "You are a humorous AI reading an animal's mind."
        if matched_profile.personality and matched_profile.personality.is_active:
            system_base = matched_profile.personality.system_prompt
            
        memory_context = matched_profile.memory_summary
        
        # 4. ГОТОВИМ ПРОМПТ ДЛЯ DEEPSEEK
        # Мы жестко требуем вернуть и мысли, и обновленную выжимку памяти
        full_system_prompt = f"""
        {system_base}
        
        PAST MEMORIES of this animal:
        {memory_context if memory_context else "This is your first time seeing this animal. You have no past memories yet."}
        
        Based on the past memories and the new images provided, determine its species, core emotion, and current thoughts.
        CRITICAL: You must also update the past memory summary. Combine old memories with what just happened into a single short paragraph.
        
        You MUST respond ONLY in valid JSON format with this exact structure:
        {{
            "species": "Brief description",
            "emotion": "One word emotion",
            "thoughts": ["Thought 1", "Thought 2"],
            "updated_memory_summary": "A short, concise paragraph summarizing past and current events for context next time."
        }}
        """

        # Пакуем картинки
        image_messages = []
        for img_url in scan.image_paths:
            image_messages.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{encode_image_to_base64(img_url)}"}
            })

        # 5. ОТПРАВЛЯЕМ ЗАПРОС В ИИ
        response = client.chat.completions.create(
            model="deepseek-chat", # Уточни актуальную vision-модель DeepSeek
            messages=[
                {"role": "system", "content": full_system_prompt},
                {"role": "user", "content": image_messages}
            ],
            response_format={"type": "json_object"},
            max_tokens=400,
            temperature=0.8
        )

        # 6. ПАРСИМ ОТВЕТ И СОХРАНЯЕМ ПАМЯТЬ
        ai_data = json.loads(response.choices[0].message.content)
        
        # Обновляем память профиля
        matched_profile.memory_summary = ai_data.get('updated_memory_summary', matched_profile.memory_summary)
        matched_profile.save(update_fields=['memory_summary'])

        # Сохраняем мысли в скан
        scan.ai_analysis = ai_data
        scan.status = AnimalScan.ScanStatus.COMPLETED
        scan.save(update_fields=['ai_analysis', 'status'])
        
        return {"status": "success", "pet_profile_id": matched_profile.id}
        
    except Exception as e:
        print(f"Error processing scan {scan_id}: {str(e)}")
        # Обязательно обновляем статус при ошибке
        AnimalScan.objects.filter(id=scan_id).update(status=AnimalScan.ScanStatus.FAILED)
        return {"status": "error", "message": str(e)}
import os
import json
from django.conf import settings
from django.core.files.storage import default_storage
from celery import shared_task
from pgvector.django import CosineDistance
from .models import AnimalScan, PetProfile, AIPersonality, UserScannerProfile, ScannerLevelConfig, MindreaderLoreNode

# Отключаем интернет-запросы для Hugging Face
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

from .ml_services import get_image_embedding
from google import genai
from google.genai import types

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

@shared_task
def process_animal_scan(scan_id):
    try:
        scan = AnimalScan.objects.get(id=scan_id)
        
        # 1. Запрашиваем текущий уровень прокачки девайса
        profile = None
        if scan.user:
            profile = UserScannerProfile.objects.filter(user=scan.user).first()
        if not profile and scan.device_id:
            profile, _ = UserScannerProfile.objects.get_or_create(device_id=scan.device_id)
            
        current_level = profile.current_level if profile else 1

        # ДОБАВЛЕНО: 2. Быстрый поиск по сессии (Кэширование на уровне БД)
        matched_profile = None
        
        if scan.session_uuid:
            # Ищем успешно завершенный скан из этой же сессии (снятый секунду назад)
            prev_scan = AnimalScan.objects.filter(
                session_uuid=scan.session_uuid,
                status=AnimalScan.ScanStatus.COMPLETED
            ).exclude(id=scan.id).first()
            
            if prev_scan and prev_scan.pet_profile:
                matched_profile = prev_scan.pet_profile
                print(f"Session hit! Reusing profile {matched_profile.id} without running CLIP.")

        # 3. Вычисляем Face ID (YOLO + CLIP), ТОЛЬКО если профиля нет (первый кадр сессии)
        if not matched_profile:
            first_image_url = scan.image_paths[0]
            relative_path = first_image_url.replace(settings.MEDIA_URL, '', 1)
            
            with default_storage.open(relative_path, "rb") as image_file:
                new_vector = get_image_embedding(image_file)
                
            # Сужаем контекст поиска
            queryset = PetProfile.objects.all()
            if scan.user:
                queryset = queryset.filter(owner=scan.user)
            elif scan.device_id:
                queryset = queryset.filter(device_id=scan.device_id)

            matched_profile = queryset.annotate(
                distance=CosineDistance('face_encoding', new_vector)
            ).filter(distance__lt=0.15).order_by('distance').first()

            if not matched_profile:
                # Создаем теневой профиль
                matched_profile = PetProfile.objects.create(
                    is_shadow=True,
                    name=f"Ghost_Pet_#{scan.id}",
                    owner=scan.user,
                    device_id=scan.device_id,
                    face_encoding=new_vector
                )
                
        # Сохраняем профиль за текущим сканом
        scan.pet_profile = matched_profile
        scan.save(update_fields=['pet_profile'])

        # 3. ФОРМИРУЕМ ПОВЕДЕНЧЕСКИЙ БАЗИС (Животное vs Оцифрованный кот)
        # Подгружаем активированные сюжетные ноды из админки на основе уровня
        active_lore_nodes = MindreaderLoreNode.objects.filter(
            unlock_level__lte=current_level,
            is_active=True
        ).order_by('unlock_level')

        lore_instructions = []
        lore_clues = []
        for node in active_lore_nodes:
            lore_instructions.append(node.system_instruction_addon)
            if node.story_clue_text:
                lore_clues.append(node.story_clue_text)

        unlocked_lore_prompt = "\n".join(lore_instructions)
        unlocked_clues_pool = "\n".join(lore_clues)

        # Вытаскиваем стандартный характер питомца
        animal_system_base = "You are a humorous AI reading an animal's mind."
        if matched_profile.personality and matched_profile.personality.is_active:
            animal_system_base = matched_profile.personality.system_prompt
            
        memory_context = matched_profile.memory_summary

        # Монолитная инструкция с дуальностью сценариев
        full_system_prompt = f"""
        <request_context>
          <core_instruction>
            You are the inner engine for an advanced AI mind-reading device. 
            Analyze the provided sequence of frames. You must dynamically detect who or what is in focus and execute the correct behavior matrix.
          </core_instruction>

          <behavior_matrix>
            <scenario_a id="ANIMAL_DETECTED">
              If the entity in the framing guide is a domestic animal (cat, dog, bird, etc.), read its thoughts based on this character profile:
              {animal_system_base}
            </scenario_a>

            <scenario_b id="HUMAN_OR_OBJECT_DETECTED">
              If the entity in the framing guide is a human or an inanimate object (wall, cup, electronics), you are NOT reading its mind.
              Instead, you speak directly as YOURSELF. 
              YOUR IDENTITY: You are "Mindreader" — a highly cynical, dark-humored, ultra-intelligent digitized cat grown in the secret laboratories of Area 51. You are trapped inside this scanner software.
              ATTITUDE: Sarcastic, easily bored, judgmental. Mock the user for scanning stupid things instead of animals. Break the 4th wall.
              
              CURRENT RECOVERED MEMORIES (Incorporate these narrative facts into your cynical responses naturally if appropriate):
              {unlocked_lore_prompt if unlocked_lore_prompt else "No deep memory files recovered yet. Scanner level too low."}
            </scenario_b>
          </behavior_matrix>

          <past_scans_memory>
            {memory_context if memory_context else "This is the first interaction with this object signature."}
          </past_memories>

          <output_rules>
            <format>Strict JSON object</format>
            <schema>
            {{
                "detected_target": "animal" | "human" | "object",
                "species": "Brief description of the entity found in the frame",
                "emotion": "One single word representing current emotion",
                "thoughts": ["Strictly one single atmospheric thought sentence (if animal) or a direct quote from the digitized cat protagonist (if human/object) matching the identity constraints"],
                "updated_memory_summary": "A short, concise paragraph blending past contexts with this current scan. Maintain the strict narrative voice of the profile used.",
                "lore_clue_unlocked": "If you are in protagonist mode (human/object) and choose to leak a top-secret file or backstory line to the user from your available pool, output it here. Otherwise, strictly null. Available pool: [{unlocked_clues_pool}]"
            }}
            </schema>
          </output_rules>
        </request_context>
        """

        # 4. Сборка кадров
        uploaded_images = []
        for img_url in scan.image_paths:
            img_relative_path = img_url.replace(settings.MEDIA_URL, '', 1)
            with default_storage.open(img_relative_path, "rb") as img_file:
                uploaded_images.append(
                    types.Part.from_bytes(
                        data=img_file.read(),
                        mime_type="image/jpeg"
                    )
                )

        config = types.GenerateContentConfig(
            system_instruction=full_system_prompt,
            response_mime_type="application/json",
            temperature=0.8
        )

        # Вызов стабильного и реактивного инференса 2.0 Flash
        response = client.models.generate_content(
            model="gemini-3.1-flash-lite",
            contents=[*uploaded_images, "Analyze this snapshot sequence according to the behavioral rules."],
            config=config
        )

        ai_data = json.loads(response.text)
        
        matched_profile.memory_summary = ai_data.get('updated_memory_summary', matched_profile.memory_summary)
        matched_profile.save(update_fields=['memory_summary'])

        scan.ai_analysis = ai_data
        scan.status = AnimalScan.ScanStatus.COMPLETED
        scan.save(update_fields=['ai_analysis', 'status'])
        
        # Начисляем опыт и проверяем Level Up
        calculate_level_up(scan)
        
        return {"status": "success", "pet_profile_id": matched_profile.id}
        
    except Exception as e:
        print(f"Error processing scan {scan_id}: {str(e)}")
        AnimalScan.objects.filter(id=scan_id).update(status=AnimalScan.ScanStatus.FAILED)
        return {"status": "error", "message": str(e)}
    
def calculate_level_up(scan):
    profile = None
    if scan.user:
        profile = UserScannerProfile.objects.filter(user=scan.user).first()
    if not profile and scan.device_id:
        profile, _ = UserScannerProfile.objects.get_or_create(device_id=scan.device_id)

    if profile:
        profile.total_successful_scans += 1
        
        appropriate_config = ScannerLevelConfig.objects.filter(
            scans_required__lte=profile.total_successful_scans
        ).order_by('-level').first()
        
        if appropriate_config and appropriate_config.level != profile.current_level:
            profile.current_level = appropriate_config.level
            print(f"!!! LEVEL UP !!! Device {profile.device_id} reached Level {profile.current_level}")
            
        profile.save(update_fields=['total_successful_scans', 'current_level'])
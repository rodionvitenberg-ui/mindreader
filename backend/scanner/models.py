from django.db import models
from django.contrib.auth import get_user_model
from pgvector.django import VectorField, HnswIndex

User = get_user_model()

class Almanac(models.Model):
    """
    Энциклопедия животных. 
    Если кто-то отсканировал рыжего кота, мы сохраняем общую сводку сюда, 
    чтобы не дергать ИИ каждый раз при запросе фактов о котах.
    """
    species = models.CharField(max_length=100, unique=True, db_index=True)
    
    # JSONB поле. Храним здесь сгенерированные ИИ факты, характеристики, 
    # чтобы гибко фильтровать данные прямо запросами к БД.
    # Пример: {"habitat": "home", "temperament": "lazy", "fun_facts": [...]}
    traits_data = models.JSONField(default=dict) 
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'almanac'
        verbose_name_plural = 'Almanac entries'

    def __str__(self):
        return self.species

class AIPersonality(models.Model):
    """
    Архетипы и характеры животных. Управляются исключительно через админку.
    """
    name = models.CharField(max_length=100, unique=True, help_text="Например: Ворчливый дед, Наивный щенок")
    system_prompt = models.TextField(
        help_text="Главная инструкция для ИИ. Опишите, как питомец должен думать и говорить."
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'ai_personalities'
        verbose_name_plural = 'AI Personalities'

    def __str__(self):
        return self.name

class PetProfile(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='pets', null=True, blank=True)
    name = models.CharField(max_length=100, default="Unknown Fluff")
    is_shadow = models.BooleanField(default=True)
    face_encoding = VectorField(dimensions=512, null=True, blank=True)
    
    # ДОБАВЛЕНО: Привязка к личности. Если null - ИИ будет использовать стандартный характер.
    personality = models.ForeignKey(AIPersonality, on_delete=models.SET_NULL, null=True, blank=True)
    
    memory_summary = models.TextField(blank=True, help_text="Rolling summary of past thoughts.")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'pet_profiles'
        indexes = [
            HnswIndex(
                name='face_vector_idx',
                fields=['face_encoding'],
                m=16, ef_construction=64, opclasses=['vector_cosine_ops']
            )
        ]

    def __str__(self):
        return f"{self.name} (Shadow: {self.is_shadow})"

class AnimalScan(models.Model):
    """
    История конкретных сканирований. 
    Связывает пользователя, кадры с камеры и сгенерированные мысли.
    """
    class ScanStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        PROCESSING = 'processing', 'Processing'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='scans', null=True, blank=True)
    species_ref = models.ForeignKey(Almanac, on_delete=models.SET_NULL, null=True, blank=True)
    pet_profile = models.ForeignKey(PetProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='scans')
    status = models.CharField(max_length=20, choices=ScanStatus.choices, default=ScanStatus.PENDING)
    
    # Храним пути к сохраненным кадрам (от 1 до 3 штук) в виде массива внутри JSONB
    image_paths = models.JSONField(default=list)
    
    # Сюда Celery-воркер запишет ответ от Deepseek/LLM. 
    # Пример: {"emotion": "judgmental", "thoughts": ["Why is this human staring?", "Where is my food?"]}
    ai_analysis = models.JSONField(default=dict, blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'animal_scans'
        # Добавляем индексы для быстрого поиска статусов воркером 
        # и для сортировки истории по дате
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['-created_at']),
        ]

    def __str__(self):
        return f"Scan {self.id} - {self.status}"
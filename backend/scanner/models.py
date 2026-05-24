from django.db import models
from django.contrib.auth import get_user_model
from pgvector.django import VectorField, HnswIndex

User = get_user_model()

class Almanac(models.Model):
    species = models.CharField(max_length=100, unique=True, db_index=True)
    traits_data = models.JSONField(default=dict) 
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'almanac'
        verbose_name_plural = 'Almanac entries'

    def __str__(self):
        return self.species

class AIPersonality(models.Model):
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
    
    # ДОБАВЛЕНО: Привязка к конкретному устройству для сужения контекста поиска
    device_id = models.CharField(max_length=255, blank=True, null=True, db_index=True)
    
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
    class ScanStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        PROCESSING = 'processing', 'Processing'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='scans', null=True, blank=True)
    device_id = models.CharField(max_length=255, blank=True, null=True, db_index=True, help_text="UUID девайса, выполнившего скан")
    session_uuid = models.CharField(max_length=255, blank=True, null=True, db_index=True)
    species_ref = models.ForeignKey(Almanac, on_delete=models.SET_NULL, null=True, blank=True)
    pet_profile = models.ForeignKey(PetProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='scans')
    status = models.CharField(max_length=20, choices=ScanStatus.choices, default=ScanStatus.PENDING)
    image_paths = models.JSONField(default=list)
    ai_analysis = models.JSONField(default=dict, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'animal_scans'
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['-created_at']),
        ]

    def __str__(self):
        return f"Scan {self.id} - {self.status}"
    
class ScannerLevelConfig(models.Model):
    level = models.IntegerField(unique=True, db_index=True, help_text="Номер уровня прибора")
    scans_required = models.IntegerField(help_text="Суммарное количество сканов, необходимое для ДОСТИЖЕНИЯ этого уровня")
    max_hold_seconds = models.IntegerField(default=3, help_text="Сколько секунд можно удерживать затвор на этом уровне")
    extra_time_seconds = models.IntegerField(
        default=5, 
        help_text="Сколько секунд видео дописывается после отпускания кнопки на этом уровне"
    )

    class Meta:
        db_table = 'scanner_level_config'
        ordering = ['level']
        verbose_name = 'Scanner Level Config'
        verbose_name_plural = 'Scanner Level Configs'

    def __str__(self):
        return f"Level {self.level} (Hold: {self.max_hold_seconds}s, Req: {self.scans_required} scans)"

class UserScannerProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='scanner_profile', null=True, blank=True)
    device_id = models.CharField(max_length=255, unique=True, db_index=True, help_text="Уникальный UUID девайса для неавторизованных")
    total_successful_scans = models.IntegerField(default=0, help_text="Общее количество выполненных сканирований")
    current_level = models.IntegerField(default=1, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_scanner_profiles'

    def __str__(self):
        return f"Profile {self.device_id[:8]}... - Level {self.current_level} (Scans: {self.total_successful_scans})"

class MindreaderLoreNode(models.Model):
    unlock_level = models.IntegerField(help_text="Уровень, начиная с которого этот лор может активироваться")
    lore_trigger_weight = models.IntegerField(default=50, help_text="Вероятность выпадения этой ноды при сканировании человека/предмета (от 1 до 100)")
    system_instruction_addon = models.TextField(
        help_text="Дополнение к системному промпту. Раскрывает характер или кусок истории. Наример: 'Вспомни, как в 1947 году тебя впервые заперли в криокамере. Иронизируй над этим.'"
    )
    story_clue_text = models.TextField(
        blank=True, 
        help_text="Прямая сюжетная улика/секретный файл, который подмешается в JSON ответ для юзера, если ИИ решит раскрыть тайну."
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'mindreader_lore_nodes'
        ordering = ['unlock_level']

    def __str__(self):
        return f"Lore Node (Unlock Lvl: {self.unlock_level}) - {self.system_instruction_addon[:30]}..."
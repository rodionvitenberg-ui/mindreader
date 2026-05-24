from django.contrib import admin
from .models import (
    Almanac,
    AIPersonality,
    PetProfile,
    AnimalScan,
    ScannerLevelConfig,
    UserScannerProfile,
    MindreaderLoreNode
)

@admin.register(Almanac)
class AlmanacAdmin(admin.ModelAdmin):
    list_display = ('species', 'created_at')
    search_fields = ('species',)
    ordering = ('species',)

@admin.register(AIPersonality)
class AIPersonalityAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('name',)

@admin.register(PetProfile)
class PetProfileAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_shadow', 'personality', 'owner', 'created_at')
    list_filter = ('is_shadow', 'personality')
    search_fields = ('name',)
    readonly_fields = ('face_encoding',)  # Вектор руками не редактируют :)

@admin.register(AnimalScan)
class AnimalScanAdmin(admin.ModelAdmin):
    list_display = ('id', 'status', 'pet_profile', 'created_at')
    list_filter = ('status',)
    ordering = ('-created_at',)

# ==========================================
# НОВЫЙ БЛОК: ГЕЙМИФИКАЦИЯ И ЛОР МАЙНДРИДЕРА
# ==========================================

@admin.register(ScannerLevelConfig)
class ScannerLevelConfigAdmin(admin.ModelAdmin):
    """
    Таблица баланса уровней. 
    Позволяет настраивать шаги прогрессии и секунды удержания затвора.
    """
    list_display = ('level', 'scans_required', 'max_hold_seconds')
    ordering = ('level',)

@admin.register(UserScannerProfile)
class UserScannerProfileAdmin(admin.ModelAdmin):
    """
    Профили прокачки девайсов пользователей.
    Показывает, кто сколько нафармил успешных сканов и какой уровень имеет.
    """
    list_display = ('device_id_short', 'user', 'current_level', 'total_successful_scans', 'updated_at')
    list_filter = ('current_level',)
    search_fields = ('device_id', 'user__username')
    ordering = ('-updated_at',)

    def device_id_short(self, obj):
        return f"{obj.device_id[:12]}..." if len(obj.device_id) > 12 else obj.device_id
    device_id_short.short_description = 'Device UUID (Срез)'

@admin.register(MindreaderLoreNode)
class MindreaderLoreNodeAdmin(admin.ModelAdmin):
    """
    Управление сюжетом Протагониста. 
    Здесь прописываются куски воспоминаний кота из Зоны 51 и триггеры их выдачи.
    """
    list_display = ('unlock_level', 'lore_trigger_weight', 'is_active', 'short_instruction')
    list_filter = ('is_active', 'unlock_level')
    ordering = ('unlock_level', '-lore_trigger_weight')
    search_fields = ('system_instruction_addon', 'story_clue_text')

    def short_instruction(self, obj):
        if len(obj.system_instruction_addon) > 60:
            return f"{obj.system_instruction_addon[:60]}..."
        return obj.system_instruction_addon
    short_instruction.short_description = 'Кусок инструкции ИИ'
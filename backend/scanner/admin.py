from django.contrib import admin
from .models import AIPersonality, PetProfile, AnimalScan

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
    readonly_fields = ('face_encoding',) # Вектор руками не редактируют :)

@admin.register(AnimalScan)
class AnimalScanAdmin(admin.ModelAdmin):
    list_display = ('id', 'status', 'pet_profile', 'created_at')
    list_filter = ('status',)
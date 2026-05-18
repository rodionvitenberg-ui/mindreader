from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, SystemSettings

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    """
    Интегрируем кастомное поле в стандартный интерфейс Django UserAdmin
    """
    fieldsets = UserAdmin.fieldsets + (
        ('Device Performance Config', {'fields': ('custom_frame_count',)}),
    )
    list_display = ('username', 'email', 'custom_frame_count', 'is_staff', 'is_active')
    search_fields = ('username', 'email')


@admin.register(SystemSettings)
class SystemSettingsAdmin(admin.ModelAdmin):
    """
    Управление глобальным конфигом. Запрещаем добавлять новые и удалять текущую запись.
    """
    list_display = ('__str__', 'default_frame_count', 'updated_at')
    
    def has_add_permission(self, request):
        # Нельзя нажать кнопку "Добавить", запись может быть только одна
        return False

    def has_delete_permission(self, request, obj=None):
        # Нельзя удалить конфигурацию
        return False
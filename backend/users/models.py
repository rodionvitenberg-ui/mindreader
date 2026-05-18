from django.contrib.auth.models import AbstractUser
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator

class User(AbstractUser):
    """
    Кастомная модель пользователя.
    custom_frame_count позволяет гибко управлять нагрузкой для конкретного аккаунта
    (например, для тестов или премиум-юзеров).
    """
    custom_frame_count = models.PositiveIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(3)],
        help_text="Custom frame count (1-3) for this specific user. If blank, global default is used."
    )

    class Meta:
        db_table = 'users'

    def __str__(self):
        return self.username


class SystemSettings(models.Model):
    """
    Глобальные настройки системы (Паттерн Singleton).
    Управляет дефолтным поведением приложения для всех пользователей.
    """
    default_frame_count = models.PositiveIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(3)],
        help_text="Global default number of frames to capture (1-3) for all users."
    )
    
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "System Settings"
        verbose_name_plural = "System Settings"
        db_table = 'system_settings'

    def save(self, *args, **kwargs):
        # Паттерн Singleton: всегда принудительно сохраняем в ID = 1
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        # Метод для удобного получения настроек в коде: SystemSettings.load()
        obj, created = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return "Global Configuration"
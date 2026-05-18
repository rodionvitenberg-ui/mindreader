import os
from celery import Celery

# Устанавливаем дефолтную переменную окружения для настроек Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Создаем экземпляр Celery
app = Celery('petmind')

# Читаем настройки из settings.py (все настройки Celery должны начинаться с CELERY_)
app.config_from_object('django.conf:settings', namespace='CELERY')

# Автоматически ищем файлы tasks.py во всех установленных приложениях (в т.ч. в scanner)
app.autodiscover_tasks()
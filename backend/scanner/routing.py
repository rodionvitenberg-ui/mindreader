from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    # Ожидаем подключение по адресу ws://domain/ws/scan/123/
    re_path(r'ws/scan/(?P<scan_id>\w+)/$', consumers.ScanConsumer.as_asgi()),
]
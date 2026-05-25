import json
from channels.generic.websocket import AsyncWebsocketConsumer

class ScanConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Достаем ID скана из URL
        self.scan_id = self.scope['url_route']['kwargs']['scan_id']
        self.scan_group_name = f'scan_{self.scan_id}'

        # Присоединяемся к "комнате" (группе) этого скана
        await self.channel_layer.group_add(
            self.scan_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        # Отписываемся при отключении
        await self.channel_layer.group_discard(
            self.scan_group_name,
            self.channel_name
        )

    # Этот метод будет вызывать Celery, когда закончит работу
    async def scan_message(self, event):
        message = event['message']
        
        # Отправляем сообщение обратно на телефон клиента
        await self.send(text_data=json.dumps(message))
import json
import logging

from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)


class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get('user')

        if self.user and self.user.is_authenticated:
            self.group_name = f'user_notifications_{self.user.id}'
            await self.channel_layer.group_add(self.group_name, self.channel_name)
            await self.accept()
            logger.info('WebSocket connected: user_id=%s', self.user.id)
        else:
            await self.close()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
            logger.info('WebSocket disconnected: user_id=%s', self.user.id)

    async def receive(self, text_data):
        pass

    async def notification_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'notification',
            'title': event['title'],
            'description': event['description'],
        }))

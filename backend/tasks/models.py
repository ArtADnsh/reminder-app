import uuid

from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class Notification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    task = models.ForeignKey('Task', on_delete=models.SET_NULL, null=True, blank=True, related_name='notifications')
    title = models.CharField(max_length=200)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(
                fields=['-created_at', 'user', 'is_read'],
                name='idx_notif_user_read',
            ),
        ]

    def __str__(self):
        return f'{self.title} -> {self.user.username}'


class WebPushSubscription(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='webpush_subscriptions')
    endpoint = models.URLField(max_length=500)
    p256dh = models.CharField(max_length=100)
    auth = models.CharField(max_length=100)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user', 'endpoint'], name='unique_user_endpoint'),
        ]

    def __str__(self):
        return f'WebPush({self.user.username} -> {self.endpoint[:50]})'


class Task(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tasks')
    title = models.CharField(max_length=100)
    description = models.CharField(max_length=500, blank=True)
    is_done = models.BooleanField(default=False)

    first_reminder = models.DateTimeField(null=True, blank=True)
    repeat_reminder = models.PositiveIntegerField(null=True, blank=True)
    time_between_reminders = models.PositiveIntegerField(null=True, blank=True)

    sent_reminders = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(
                fields=['is_done', 'first_reminder', 'sent_reminders'],
                name='idx_reminder_check',
            ),
        ]

    def __str__(self):
        return self.title


class TelegramConnection(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='telegram_connection')
    chat_id = models.CharField(max_length=100, unique=True, null=True, blank=True)
    link_token = models.UUIDField(default=uuid.uuid4, unique=True)

    def __str__(self):
        return f'Telegram({self.user.username} -> {self.chat_id or "unlinked"})'

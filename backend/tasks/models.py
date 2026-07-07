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

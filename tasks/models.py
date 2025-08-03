from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

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

    def __str__(self):
        return self.title

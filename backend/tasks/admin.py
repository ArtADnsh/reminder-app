from django.contrib import admin
from .models import Task


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'is_done', 'first_reminder', 'sent_reminders', 'created_at')
    list_filter = ('is_done', 'created_at')
    search_fields = ('title', 'user__username')
    readonly_fields = ('created_at', 'sent_reminders')

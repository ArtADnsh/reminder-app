from django.contrib import admin
from .models import Task, WebPushSubscription, Notification


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'is_done', 'first_reminder', 'sent_reminders', 'created_at')
    list_filter = ('is_done', 'created_at')
    search_fields = ('title', 'user__username')
    readonly_fields = ('created_at', 'sent_reminders')


@admin.register(WebPushSubscription)
class WebPushSubscriptionAdmin(admin.ModelAdmin):
    list_display = ('user', 'endpoint')
    list_filter = ('user',)
    search_fields = ('user__username', 'endpoint')


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('title', 'task', 'user', 'is_read', 'created_at')
    list_filter = ('task', 'user', 'is_read', 'created_at')
    search_fields = ('title', 'task__title', 'user__username')
    readonly_fields = ('created_at',)
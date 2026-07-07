import logging
from datetime import timedelta

from asgiref.sync import async_to_sync
from celery import shared_task
from channels.layers import get_channel_layer
from django.conf import settings as django_settings
from django.core.mail import send_mail
from django.utils import timezone

from .models import Task, Notification

logger = logging.getLogger(__name__)


def _send_reminder(task):
    """Send email, WebSocket notification, and persist a Notification record."""
    user = task.user
    subject = f'Task Reminder: {task.title}'
    message = f'This is a reminder to complete your task: {task.title}'

    # 1. Try sending the Email (Don't let failures block other steps)
    try:
        send_mail(subject, message, django_settings.EMAIL_HOST_USER, [user.email])
        logger.info('Reminder email sent: task_id=%s recipient=%s', task.id, user.email)
    except Exception:
        logger.error('Failed to send reminder email: task_id=%s recipient=%s', task.id, user.email, exc_info=True)

    # 2. Persist Notification record in the database
    try:
        Notification.objects.create(
            user=user,
            task=task,
            title=subject,
        )
        logger.info('Notification persisted: task_id=%s user_id=%s', task.id, user.id)
    except Exception:
        logger.error('Failed to persist notification: task_id=%s user_id=%s', task.id, user.id, exc_info=True)

    # 3. Try sending the WebSocket Live Notification
    try:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'user_notifications_{user.id}',
            {
                'type': 'notification_message',
                'title': task.title,
            },
        )
        logger.info('WebSocket notification dispatched: task_id=%s user_id=%s', task.id, user.id)
    except Exception:
        logger.error('Failed to send WebSocket notification: task_id=%s user_id=%s', task.id, user.id, exc_info=True)


@shared_task
def check_and_send_reminders():
    """Periodic task — runs every 60s via Celery Beat.

    SINGLE source of truth for dispatching reminders. Directly executes any
    due reminders (email + WebSocket) and increments the counter. No delegation
    to apply_async, no post_save scheduling.
    """
    now = timezone.now()

    tasks = Task.objects.filter(
        is_done=False,
        first_reminder__isnull=False,
    ).select_related('user')

    for task in tasks:
        repeat_limit = task.repeat_reminder or 0
        interval_minutes = task.time_between_reminders or 0

        due = False

        if task.sent_reminders == 0:
            # First reminder execution
            due = now >= task.first_reminder
        else:
            # Repeated reminder execution logic
            if task.sent_reminders < repeat_limit:
                next_scheduled = task.first_reminder + timedelta(
                    minutes=(interval_minutes * task.sent_reminders)
                )
                due = now >= next_scheduled

        if due:
            try:
                _send_reminder(task)
                task.sent_reminders += 1
                task.save(update_fields=['sent_reminders'])
                logger.info(
                    'Periodic reminder sent: task_id=%s sent_reminders=%s',
                    task.id, task.sent_reminders,
                )
            except Exception:
                logger.error(
                    'Periodic reminder failed: task_id=%s', task.id, exc_info=True,
                )

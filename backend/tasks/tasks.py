import logging

from asgiref.sync import async_to_sync
from celery import shared_task
from channels.layers import get_channel_layer
from django.conf import settings as django_settings
from django.core.mail import send_mail
from datetime import timedelta
from django.utils import timezone
from .models import Task
from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Task)
def schedule_first_reminder(sender, instance, created, **kwargs):
    if created and not instance.is_done:
        celery_task_id = f"task_{instance.id}_reminder_0"
        send_reminder_email.apply_async((instance.id,), eta=instance.first_reminder, task_id=celery_task_id)


def _send_reminder(task):
    """Send email + WebSocket notification for a single task."""
    user = task.user
    subject = f'Task Reminder: {task.title}'
    message = f'This is a reminder to complete your task: {task.title}'

    try:
        send_mail(subject, message, django_settings.EMAIL_HOST_USER, [user.email])
    except Exception:
        logger.error(
            'Failed to send reminder email: task_id=%s recipient=%s',
            task.id, user.email, exc_info=True,
        )
        raise

    logger.info(
        'Reminder email sent: task_id=%s recipient=%s',
        task.id, user.email,
    )

    try:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'user_notifications_{user.id}',
            {
                'type': 'notification_message',
                'title': task.title,
                'description': f'Reminder: {task.title}',
            },
        )
    except Exception:
        logger.error(
            'Failed to send WebSocket notification: task_id=%s user_id=%s',
            task.id, user.id, exc_info=True,
        )


@shared_task
def send_reminder_email(task_id):
    logger.info('Processing reminder email: task_id=%s', task_id)

    try:
        task = Task.objects.select_related('user').get(id=task_id)

        if task.is_done:
            return

        if not task.first_reminder:
            return

        now = timezone.now()

        if now >= task.first_reminder:
            _send_reminder(task)

            task.sent_reminders += 1
            task.save(update_fields=['sent_reminders'])

            if task.sent_reminders < (task.repeat_reminder or 1):
                next_time = task.first_reminder + timedelta(
                    minutes=task.time_between_reminders * task.sent_reminders
                )
                celery_task_id = f"task_{task.id}_reminder_{task.sent_reminders}"
                send_reminder_email.apply_async(
                    (task.id,), eta=next_time, task_id=celery_task_id,
                )
        else:
            celery_task_id = f"task_{task.id}_reminder_0"
            send_reminder_email.apply_async(
                (task.id,), eta=task.first_reminder, task_id=celery_task_id,
            )

    except Task.DoesNotExist:
        logger.error(
            'Task not found for reminder: task_id=%s', task_id, exc_info=True,
        )


@shared_task
def check_and_send_reminders():
    """Periodic task — runs every 60s via Celery Beat.

    Directly executes any due reminders (email + WebSocket) and increments
    the counter. No delegation to apply_async.
    """
    now = timezone.now()

    tasks = Task.objects.filter(
        is_done=False,
        first_reminder__isnull=False,
    ).select_related('user').iterator()

    for task in tasks:
        if task.sent_reminders == 0:
            # First reminder: due when now >= first_reminder
            due = now >= task.first_reminder
        else:
            # Repeated reminder: still has sends remaining?
            if task.sent_reminders >= task.repeat_reminder:
                continue
            next_scheduled = task.first_reminder + timedelta(
                minutes=task.time_between_reminders * task.sent_reminders
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
                    'Periodic reminder failed: task_id=%s', task.id,
                    exc_info=True,
                )

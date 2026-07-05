import logging

from celery import shared_task
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
        # ساخت یک آیدی یکتا بر اساس آیدی خودِ تسک
        celery_task_id = f"task_{instance.id}"
        send_reminder_email.apply_async((instance.id,), eta=instance.first_reminder, task_id=celery_task_id)


@shared_task
def send_reminder_email(task_id):
    logger.info('Processing reminder email: task_id=%s', task_id)

    try:
        task = Task.objects.get(id=task_id)

        if not task.is_done:
            if timezone.now() >= task.first_reminder:
                user_account = task.user
                to_email = user_account.email
                subject = f'Task Reminder: {task.title}'
                message = f'This is a reminder to complete your task: {task.title}'

                try:
                    send_mail(subject, message, 'artadnsh@gmail.com', [to_email])
                except Exception:
                    logger.error(
                        'Failed to send reminder email: task_id=%s recipient=%s',
                        task_id,
                        to_email,
                        exc_info=True,
                    )
                    raise

                logger.info(
                    'Reminder email sent successfully: task_id=%s recipient=%s',
                    task_id,
                    to_email,
                )

                task.sent_reminders += 1
                task.save()

                if task.sent_reminders < task.repeat_reminder:
                    next_reminder_time = task.first_reminder + timedelta(
                        minutes=task.time_between_reminders * task.sent_reminders)

                    # اختصاص دوباره همان آیدی برای تکرار بعدی
                    celery_task_id = f"task_{task.id}"
                    send_reminder_email.apply_async((task.id,), eta=next_reminder_time, task_id=celery_task_id)
            else:
                next_reminder_time = timezone.localtime(task.first_reminder)
                celery_task_id = f"task_{task.id}"
                send_reminder_email.apply_async((task.id,), eta=next_reminder_time, task_id=celery_task_id)

    except Task.DoesNotExist:
        logger.error(
            'Task not found for reminder processing: task_id=%s',
            task_id,
            exc_info=True,
        )


@shared_task
def check_and_send_reminders():
    now = timezone.now()

    tasks = Task.objects.filter(
        is_done=False,
        first_reminder__lte=now,
        sent_reminders=0
    ).select_related('user').iterator()

    for task in tasks:
        if task.sent_reminders < task.repeat_reminder:
            celery_task_id = f"task_{task.id}"
            send_reminder_email.apply_async((task.id,), eta=task.first_reminder, task_id=celery_task_id)

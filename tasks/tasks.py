from celery import shared_task
from django.core.mail import send_mail
from django.contrib.auth.models import User
from datetime import datetime, timedelta
from django.utils import timezone
from .models import Task
from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender=Task)
def schedule_first_reminder(sender, instance, created, **kwargs):
    if created and not instance.is_done:
        send_reminder_email.apply_async((instance.id,), eta=instance.first_reminder)

@shared_task
def send_reminder_email(task_id):
    try:
        task = Task.objects.get(id=task_id)

        if not task.is_done:
            # Check if it's the correct time to send the first reminder email
            if timezone.now() >= task.first_reminder:
                # Send the reminder email
                user_account = task.user
                to_email = user_account.email
                subject = f'Task Reminder: {task.title}'
                message = f'This is a reminder to complete your task: {task.title}'

                send_mail(subject, message, 'artadnsh@gmail.com', [to_email])

                task.sent_reminders += 1
                task.save()

                # Schedule next reminder if needed
                if task.sent_reminders < task.repeat_reminder:
                    next_reminder_time = task.first_reminder + timedelta(minutes=task.time_between_reminders * task.sent_reminders)
                    
                    # Schedule the next reminder at the correct time
                    send_reminder_email.apply_async((task.id,), eta=next_reminder_time)
            else:
                # If it's not yet time for the first reminder, reschedule the task
                next_reminder_time = timezone.localtime(task.first_reminder)
                send_reminder_email.apply_async((task.id,), eta=next_reminder_time)

    except Task.DoesNotExist:
        print(f"Task with ID {task_id} does not exist.")

@shared_task
def check_and_send_reminders():
    now = datetime.now()

    tasks = Task.objects.filter(is_done=False, first_reminder__lte=now)
    
    for task in tasks:

        if task.sent_reminders < task.repeat_reminder:
            send_reminder_email.apply_async((task.id,), eta=task.first_reminder)

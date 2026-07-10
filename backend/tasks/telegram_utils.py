from telebot import TeleBot, apihelper
from django.conf import settings

def send_telegram_notification(chat_id, message):
    # تنظیم پروکسی برای اینکه Celery Worker هم از تونل رد شود
    apihelper.proxy = {'https': 'http://xray-proxy:10809'}
    
    bot = TeleBot(settings.TELEGRAM_BOT_TOKEN)
    bot.send_message(chat_id, message)
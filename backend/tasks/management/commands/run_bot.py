import logging

from django.conf import settings
from django.core.management.base import BaseCommand

import telebot
from telebot import apihelper

from tasks.models import TelegramConnection

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Start the Telegram bot in long-polling mode'

    def handle(self, *args, **options):
        token = settings.TELEGRAM_BOT_TOKEN
        if not token:
            self.stderr.write(self.style.ERROR(
                'TELEGRAM_BOT_TOKEN is not set. Add it to your .env file.'
            ))
            return

        bot = telebot.TeleBot(token, parse_mode=None)
        apihelper.proxy = {'https': 'http://xray-proxy:10809'}

        @bot.message_handler(commands=['start'])
        def handle_start(message):
            parts = message.text.split(maxsplit=1)
            if len(parts) < 2:
                bot.reply_to(message, 'Welcome! Please use the link from the app to connect your account.')
                return

            link_token = parts[1]
            try:
                conn = TelegramConnection.objects.get(link_token=link_token)
            except TelegramConnection.DoesNotExist:
                bot.reply_to(message, 'Invalid or expired link. Please generate a new one from the app.')
                return

            if conn.chat_id and conn.chat_id != str(message.chat.id):
                bot.reply_to(message, 'This link has already been used by another Telegram account.')
                return

            conn.chat_id = str(message.chat.id)
            conn.save(update_fields=['chat_id'])
            bot.reply_to(message, '\u2705 Your account is successfully linked! You will now receive reminders here.')

        self.stdout.write(self.style.SUCCESS('Telegram bot is running...'))
        logger.info('Telegram bot started (polling)')
        bot.infinity_polling()

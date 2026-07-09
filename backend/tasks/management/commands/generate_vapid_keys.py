import base64
from django.core.management.base import BaseCommand
from vapid import Vapid


class Command(BaseCommand):
    help = 'Generate VAPID keys for Web Push Notifications'

    def handle(self, *args, **options):
        vapid = Vapid()
        vapid.generate_keys()

        private_key_b64 = base64.urlsafe_b64encode(vapid.private_pem()).decode().rstrip('=')
        public_key_b64 = base64.urlsafe_b64encode(vapid.public_pem()).decode().rstrip('=')

        self.stdout.write(self.style.SUCCESS('\n' + '=' * 60))
        self.stdout.write(self.style.SUCCESS('  VAPID Keys Generated Successfully'))
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(f'\n  VAPID_PRIVATE_KEY={private_key_b64}')
        self.stdout.write(f'  VAPID_PUBLIC_KEY={public_key_b64}\n')
        self.stdout.write(self.style.SUCCESS('Add these to your .env file.'))
        self.stdout.write(self.style.SUCCESS('Share the PUBLIC KEY with your frontend client.\n'))
        self.stdout.write(self.style.SUCCESS('=' * 60))

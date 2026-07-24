from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tasks', '0009_otp_verification'),
    ]

    operations = [
        # Remove old composite constraint before altering endpoint
        migrations.RemoveConstraint(
            model_name='webpushsubscription',
            name='unique_user_endpoint',
        ),
        # endpoint is globally unique per the Web Push spec; add unique=True
        migrations.AlterField(
            model_name='webpushsubscription',
            name='endpoint',
            field=models.URLField(max_length=500, unique=True),
        ),
        # Increase field lengths to prevent truncation of base64-encoded keys
        migrations.AlterField(
            model_name='webpushsubscription',
            name='p256dh',
            field=models.CharField(max_length=255),
        ),
        migrations.AlterField(
            model_name='webpushsubscription',
            name='auth',
            field=models.CharField(max_length=255),
        ),
    ]

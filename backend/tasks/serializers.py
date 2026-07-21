from rest_framework import serializers
from django.utils import timezone
from django.contrib.auth import get_user_model
from datetime import timedelta
from django.contrib.auth.password_validation import validate_password

from .models import Task, Notification, WebPushSubscription, Category, OTPVerification

User = get_user_model()


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'color', 'created_at']
        read_only_fields = ['id', 'created_at']


class TaskSerializer(serializers.ModelSerializer):
    first_reminder = serializers.DateTimeField(required=False, allow_null=True)
    next_reminder = serializers.SerializerMethodField(read_only=True)
    category = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.none(), required=False, allow_null=True,
    )

    class Meta:
        model = Task
        fields = [
            'id',
            'title',
            'description',
            'is_done',
            'category',
            'recurrence',
            'first_reminder',
            'repeat_reminder',          # total number of reminders (includes the first one)
            'time_between_reminders',   # minutes between subsequent reminders
            'next_reminder',
            'sent_reminders',
            'created_at',
        ]
        read_only_fields = [
            'id',
            'next_reminder',
            'created_at',
            'sent_reminders',
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        if request and request.user:
            self.fields['category'].queryset = Category.objects.filter(user=request.user)

    def get_next_reminder(self, obj):
        if obj.is_done:
            return None

        first = obj.first_reminder
        total = obj.repeat_reminder
        interval = obj.time_between_reminders

        if not first or not total:
            return None

        now = timezone.now()

        if total == 1:
            return first if first >= now else None

        if interval is None or interval <= 0:
            return None

        elapsed_seconds = (now - first).total_seconds()
        if elapsed_seconds < 0:
            return first

        interval_seconds = interval * 60
        passed_slots = int(elapsed_seconds // interval_seconds) + 1
        if passed_slots >= total:
            return None

        return first + timedelta(minutes=interval * passed_slots)

    def validate(self, attrs):
        def current(name):
            return attrs.get(name, getattr(self.instance, name, None))

        first = current('first_reminder')
        repeat = current('repeat_reminder')
        interval = current('time_between_reminders')

        # No reminder configured
        if first is None and repeat is None and interval is None:
            return attrs

        # Missing start while other fields present
        if first is None and (repeat is not None or interval is not None):
            raise serializers.ValidationError("first_reminder is required when reminder fields are set.")

        # If start exists but repeat not given : assume single reminder
        if repeat is None and first is not None:
            attrs['repeat_reminder'] = 1
            repeat = 1

        if repeat is not None and repeat < 1:
            raise serializers.ValidationError("repeat_reminder must be at least 1 or left empty.")

        # Single reminder
        if repeat == 1:
            if interval not in (None, 0, ''):
                attrs['time_between_reminders'] = None
            return attrs

        # Multiple reminders
        if repeat and repeat >= 2:
            if interval is None:
                raise serializers.ValidationError("time_between_reminders is required when repeat_reminder >= 2.")
            if interval <= 0:
                raise serializers.ValidationError("time_between_reminders must be greater than 0.")
            return attrs

        return attrs

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        if instance.category:
            ret['category'] = CategorySerializer(instance.category).data
        return ret


class SignUpSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    email = serializers.EmailField(required=True)

    class Meta:
        model = User
        fields = ('username', 'email', 'password')


class ResendOTPSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)


class VerifyOTPSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    otp = serializers.CharField(min_length=6, max_length=6, required=True)


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'date_joined')
        read_only_fields = ('id', 'date_joined', 'email')

    def validate_username(self, value):
        user = self.context['request'].user
        if User.objects.filter(username=value).exclude(pk=user.pk).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Incorrect password.")
        return value


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ('id', 'task_id', 'title', 'is_read', 'created_at')
        read_only_fields = ('id', 'created_at')


class WebPushSubscriptionSerializer(serializers.Serializer):
    endpoint = serializers.URLField(max_length=500)
    keys = serializers.DictField(child=serializers.CharField(), write_only=True)

    def validate_keys(self, value):
        if 'p256dh' not in value or 'auth' not in value:
            raise serializers.ValidationError("keys must contain 'p256dh' and 'auth'.")
        return value

    def create(self, validated_data):
        user = self.context['request'].user
        keys = validated_data.pop('keys')
        obj, _ = WebPushSubscription.objects.update_or_create(
            user=user,
            endpoint=validated_data['endpoint'],
            defaults={'p256dh': keys['p256dh'], 'auth': keys['auth']},
        )
        return obj
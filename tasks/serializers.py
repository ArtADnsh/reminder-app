from rest_framework import serializers
from django.utils import timezone
from datetime import timedelta
from .models import Task


class TaskSerializer(serializers.ModelSerializer):
    first_reminder = serializers.DateTimeField(required=False, allow_null=True)
    next_reminder = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Task
        fields = [
            'id',
            'title',
            'description',
            'is_done',
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

    def get_next_reminder(self, obj):
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
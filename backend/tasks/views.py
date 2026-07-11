import calendar
import logging
from datetime import timedelta

from rest_framework.decorators import action
from rest_framework.viewsets import ModelViewSet
from rest_framework.generics import CreateAPIView
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from django.contrib.auth import get_user_model
from django.utils import timezone
from django.conf import settings as django_settings

from .models import Task, Notification, WebPushSubscription, TelegramConnection, Category
from .serializers import TaskSerializer, SignUpSerializer, UserProfileSerializer, ChangePasswordSerializer, NotificationSerializer, WebPushSubscriptionSerializer, CategorySerializer

User = get_user_model()
logger = logging.getLogger(__name__)


# ==========================================
# 1. Task Management (ViewSets)
# ==========================================
class CategoryViewSet(ModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Category.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class TaskViewSet(ModelViewSet):
    """مدیریت کامل تسک‌ها (CRUD)"""
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Task.objects.filter(user=self.request.user)
        is_mine_requested = self.request.query_params.get('mine') in ('1', 'true', 'True')

        if self.request.user.is_staff and not is_mine_requested:
            qs = Task.objects.all()

        filter_value = self.request.query_params.get('filter')
        today = timezone.localdate()

        if filter_value == 'today':
            qs = qs.filter(first_reminder__date=today)
        elif filter_value == 'week':
            week_end = today + timedelta(days=7)
            qs = qs.filter(first_reminder__date__gte=today, first_reminder__date__lte=week_end)
        elif filter_value == 'month':
            month_start = today.replace(day=1)
            month_end = today.replace(day=calendar.monthrange(today.year, today.month)[1])
            qs = qs.filter(first_reminder__date__gte=month_start, first_reminder__date__lte=month_end)

        status_value = self.request.query_params.get('status')

        if status_value == 'pending':
            qs = qs.filter(is_done=False)
        elif status_value == 'completed':
            qs = qs.filter(is_done=True)

        category_id = self.request.query_params.get('category')
        if category_id:
            qs = qs.filter(category_id=category_id)

        is_recurring = self.request.query_params.get('is_recurring')
        if is_recurring in ('1', 'true', 'True'):
            qs = qs.exclude(recurrence='none')

        return qs.order_by('-id')

    def perform_create(self, serializer):
        instance = serializer.save(user=self.request.user)
        logger.info(
            'Task created: user_id=%s task_id=%s',
            self.request.user.id,
            instance.id,
        )

    def perform_update(self, serializer):
        was_incomplete = not serializer.instance.is_done
        instance = serializer.save()
        if was_incomplete and instance.is_done and instance.recurrence != 'none':
            instance.clone_for_recurrence()
        logger.info(
            'Task updated: user_id=%s task_id=%s is_done=%s',
            self.request.user.id,
            instance.id,
            instance.is_done,
        )

    def perform_destroy(self, instance):
        user_id = self.request.user.id
        task_id = instance.id
        instance.delete()
        logger.info(
            'Task deleted: user_id=%s task_id=%s',
            user_id,
            task_id,
        )


# ==========================================
# 2. Authentication Views (CBVs)
# ==========================================
class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    سفارشی‌سازی دیتای بازگشتی در هنگام لاگین.
    به طور پیش‌فرض فقط توکن‌ها برمی‌گردند، اما ما اطلاعات پایه کاربر را هم اضافه می‌کنیم.
    """

    def validate(self, attrs):
        data = super().validate(attrs)

        # اضافه کردن اطلاعات کاربر به پاسخ JSON لاگین
        data['username'] = self.user.username
        data['email'] = self.user.email
        data['user_id'] = self.user.id
        return data


class SignUpView(CreateAPIView):
    """
    ثبت‌نام کاربر جدید
    استفاده از CreateAPIView تمام منطق اعتبارسنجی، ذخیره و ارسال پاسخ ۲۰۱ را
    به صورت خودکار و پشت صحنه انجام می‌دهد.
    """
    queryset = User.objects.all()
    permission_classes = [AllowAny]
    serializer_class = SignUpSerializer

    def perform_create(self, serializer):
        user = serializer.save()
        logger.info(
            'User signup successful: user_id=%s username=%s',
            user.id,
            user.username,
        )


class LoginView(TokenObtainPairView):
    """
    ویوی ورود (Login) کاملاً کلاس‌محور و سازگار با API.
    نام کاربری و رمز عبور را در قالب JSON می‌گیرد و توکن‌ها + اطلاعات کاربر را پس می‌دهد.
    """
    permission_classes = [AllowAny]
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        username = request.data.get('username', 'unknown')

        if response.status_code == status.HTTP_200_OK:
            logger.info('User login successful: username=%s', username)
        else:
            logger.warning('Failed login attempt: username=%s', username)

        return response


class LogoutView(APIView):
    """خروج کاربر و منقضی کردن رفرش‌توکن"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            if "refresh" in request.data:
                refresh_token = request.data["refresh"]
                token = RefreshToken(refresh_token)
                token.blacklist()

            response = Response({"msg": "Logout successful"}, status=status.HTTP_205_RESET_CONTENT)
            response.delete_cookie('access_token')
            return response
        except Exception as e:
            return Response({"error": "Invalid token or request"}, status=status.HTTP_400_BAD_REQUEST)


# ==========================================
# 3. User Profile (/me)
# ==========================================
class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserProfileSerializer(request.user, context={'request': request})
        return Response(serializer.data)

    def patch(self, request):
        serializer = UserProfileSerializer(
            request.user, data=request.data, partial=True, context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def put(self, request):
        serializer = UserProfileSerializer(
            request.user, data=request.data, context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save()
        return Response({"msg": "Password changed successfully."}, status=status.HTTP_200_OK)


# ==========================================
# 4. Notifications
# ==========================================
class NotificationViewSet(ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'patch', 'post', 'delete']

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        unread_only = request.query_params.get('unread')
        if unread_only in ('1', 'true', 'True'):
            qs = qs.filter(is_read=False)
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        return Response(self.get_serializer(qs, many=True).data)

    @action(detail=True, methods=['patch'], url_path='mark-read')
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=['is_read'])
        return Response(self.get_serializer(notification).data)

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        updated = self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({'marked_read': updated})

    def perform_destroy(self, instance):
        instance.delete()


# ==========================================
# 5. Web Push Notifications
# ==========================================
class WebPushSubscribeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = WebPushSubscriptionSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"msg": "Subscription saved."}, status=status.HTTP_201_CREATED)


# ==========================================
# 6. Telegram Bot Linking
# ==========================================
class GetTelegramLinkView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        conn, _ = TelegramConnection.objects.get_or_create(user=request.user)
        bot_username = getattr(django_settings, 'TELEGRAM_BOT_USERNAME', '')
        return Response({
            'link_token': str(conn.link_token),
            'bot_username': bot_username,
            'is_connected': bool(conn.chat_id),
        })

    def delete(self, request):
        try:
            conn = TelegramConnection.objects.get(user=request.user)
        except TelegramConnection.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        conn.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

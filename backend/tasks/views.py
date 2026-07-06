import logging

from rest_framework.viewsets import ModelViewSet
from rest_framework.generics import CreateAPIView
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from TODOList.celery import app as celery_app

from django.contrib.auth import get_user_model

from .models import Task
from .serializers import TaskSerializer, SignUpSerializer

User = get_user_model()
logger = logging.getLogger(__name__)


def _revoke_celery_task(task_instance):
    """Revoke all pending Celery reminders for the given task."""
    for i in range(task_instance.sent_reminders, task_instance.repeat_reminder or 1):
        celery_task_id = f"task_{task_instance.id}_reminder_{i}"
        try:
            celery_app.control.revoke(celery_task_id, terminate=True)
        except Exception:
            logger.error(
                'Failed to revoke Celery task: celery_task_id=%s',
                celery_task_id,
                exc_info=True,
            )
            raise


# ==========================================
# 1. Task Management (ViewSets)
# ==========================================
class TaskViewSet(ModelViewSet):
    """مدیریت کامل تسک‌ها (CRUD)"""
    queryset = Task.objects.all()
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Task.objects.filter(user=self.request.user)
        is_mine_requested = self.request.query_params.get('mine') in ('1', 'true', 'True')

        if self.request.user.is_staff and not is_mine_requested:
            return Task.objects.all().order_by('-id')

        return qs.order_by('-id')

    def perform_create(self, serializer):
        instance = serializer.save(user=self.request.user)
        logger.info(
            'Task created: user_id=%s task_id=%s',
            self.request.user.id,
            instance.id,
        )

    # ------------ بخش برای Revoke کردن ------------

    def perform_update(self, serializer):
        instance = serializer.save()
        logger.info(
            'Task updated: user_id=%s task_id=%s is_done=%s',
            self.request.user.id,
            instance.id,
            instance.is_done,
        )
        # اگر کاربر تسک را به عنوان انجام‌شده تیک زد، یادآور لغو شود
        if instance.is_done:
            _revoke_celery_task(instance)

    def perform_destroy(self, instance):
        user_id = self.request.user.id
        task_id = instance.id
        # قبل از حذف کردن تسک از دیتابیس، پردازش آن را در سلری لغو کن
        _revoke_celery_task(instance)
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

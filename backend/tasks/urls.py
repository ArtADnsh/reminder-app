from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    TaskViewSet, SignUpView, LoginView, LogoutView,
    UserProfileView, ChangePasswordView, NotificationViewSet,
    WebPushSubscribeView, GetTelegramLinkView, CategoryViewSet,
    ResendOTPView, VerifyOTPView,
)


router = DefaultRouter()
router.register(r'tasks', TaskViewSet, basename='task')
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'categories', CategoryViewSet, basename='category')

urlpatterns = [
    path('auth/signup/', SignUpView.as_view(), name='api_signup'),
    path('auth/verify-otp/', VerifyOTPView.as_view(), name='api_verify_otp'),
    path('auth/resend-otp/', ResendOTPView.as_view(), name='api_resend_otp'),
    path('auth/login/', LoginView.as_view(), name='api_login'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),

    path('users/me/', UserProfileView.as_view(), name='user_profile'),
    path('users/me/change-password/', ChangePasswordView.as_view(), name='change_password'),

    path('webpush/subscribe/', WebPushSubscribeView.as_view(), name='webpush_subscribe'),

    path('telegram/link/', GetTelegramLinkView.as_view(), name='telegram_link'),

    path('', include(router.urls)),
]
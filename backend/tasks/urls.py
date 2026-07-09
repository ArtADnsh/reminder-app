from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import TaskViewSet, SignUpView, LoginView, LogoutView, UserProfileView, ChangePasswordView, NotificationViewSet, WebPushSubscribeView


router = DefaultRouter()
router.register(r'tasks', TaskViewSet, basename='task')
router.register(r'notifications', NotificationViewSet, basename='notification')

urlpatterns = [
    path('auth/signup/', SignUpView.as_view(), name='api_signup'),
    path('auth/login/', LoginView.as_view(), name='api_login'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),

    path('users/me/', UserProfileView.as_view(), name='user_profile'),
    path('users/me/change-password/', ChangePasswordView.as_view(), name='change_password'),

    path('webpush/subscribe/', WebPushSubscribeView.as_view(), name='webpush_subscribe'),

    path('', include(router.urls)),
]
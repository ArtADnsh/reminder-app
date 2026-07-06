from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import TaskViewSet, SignUpView, LoginView, LogoutView


# تنظیم روتر برای مدیریت اتوماتیک CRUD تسک‌ها
router = DefaultRouter()
router.register(r'tasks', TaskViewSet, basename='task')

urlpatterns = [
    # درگاه‌های احراز هویت (Authentication Endpoints)
    path('auth/signup/', SignUpView.as_view(), name='api_signup'),
    path('auth/login/', LoginView.as_view(), name='api_login'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),

    path('', include(router.urls)),
]
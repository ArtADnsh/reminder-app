from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.contrib.auth.views import LoginView

urlpatterns = [
    # 1) Admin site
    path('admin/', admin.site.urls),

    # 2) JWT endpoints
    path('api/token/',         TokenObtainPairView.as_view(),  name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(),     name='token_refresh'),

    # 3) ریدایرکت ریشه به صفحه تسک‌ها
    path('', RedirectView.as_view(url='/tasks/', permanent=False)),

    # 4) صفحات HTML اپ تسک
    path('tasks/', include('tasks.urls', namespace='tasks')),
    
    # 5) API اپ تسک
    path('api/', include('tasks.api_urls')),

    path('login/', LoginView.as_view(template_name='tasks.html', next_page='/tasks/'), name='login'),
    path('signup/', LoginView.as_view(template_name='tasks.html', next_page='/tasks/'), name='login'),
]

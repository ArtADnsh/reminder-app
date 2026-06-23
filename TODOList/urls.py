from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    # ۱. پنل مدیریت جنگو
    path('admin/', admin.site.urls),

    # ۲. اتصال تمام کدهای مسیر اپلیکیشن تسک به هاب مرکزی تحت پیشوند api
    path('api/', include('tasks.urls')),
]
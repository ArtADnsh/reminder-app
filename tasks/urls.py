from django.urls import path
from .views import signup_view, login_view, logout_view, task_list_page

app_name = 'tasks'

urlpatterns = [
    path('signup/', signup_view,   name='signup'),
    path('login/',  login_view,    name='login'),
    path('logout/', logout_view,   name='logout'),
    path('',        task_list_page, name='task_list'),
]

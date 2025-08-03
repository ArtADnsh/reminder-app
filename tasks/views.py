from django.shortcuts import render
from .models import Task
from .serializers import TaskSerializer
from .tasks import send_reminder_email
from django.shortcuts import render, redirect
from django.contrib.auth import login, logout
from django.contrib.auth.forms import AuthenticationForm
from .forms import SignUpForm
from rest_framework_simplejwt.tokens import RefreshToken
from django.http import HttpResponseRedirect, JsonResponse
from rest_framework.authtoken.models import Token
from django.contrib.auth.decorators import login_required
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet
from rest_framework.authtoken.models import Token
from django.views.decorators.csrf import csrf_exempt
import json

def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }


class TaskViewSet(ModelViewSet):
    queryset = Task.objects.all()
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Task.objects.filter(user=self.request.user)
        if self.request.user.is_staff and self.request.query_params.get('mine') not in ('1', 'true', 'True'):
            qs = Task.objects.all()
        return qs.order_by('-id')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

@csrf_exempt
def signup_view(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        form = SignUpForm(data)
        if form.is_valid():
            form.save()
            return JsonResponse({'msg': 'signup success'}, status=201)
        else:
            return JsonResponse({'errors': form.errors}, status=400)
    
    return render(request, 'signup.html')

#login view
def login_view(request):
    if request.method == 'POST':
        form = AuthenticationForm(request, data=request.POST)
        if form.is_valid():
            user = form.get_user()
            login(request, user)

            token, created = Token.objects.get_or_create(user=user)
            request.session['auth_token'] = token.key
            response = HttpResponseRedirect('/api/')
            response.set_cookie('auth_token', token.key, httponly=True, samesite='Lax')
            return response

        return JsonResponse({'token': token.key})

    
    else:
        form = AuthenticationForm()
    return render(request, 'login.html', {'form': form})
    
#logout view
def logout_view(request):
    logout(request)
    return redirect('login')

@login_required
def task_list_page(request):
    return render(request, 'tasks.html')

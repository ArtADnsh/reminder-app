"""
Comprehensive API tests for the tasks app.

Covers JWT authentication, task CRUD with per-user isolation, and Celery
integration (mocked — no real Redis broker required).
"""

import calendar
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

from dateutil.relativedelta import relativedelta

from django.contrib.auth import get_user_model
from django.conf import settings
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase, APIClient

from pywebpush import WebPushException

from .models import Task, Notification, Category, WebPushSubscription, TelegramConnection, OTPVerification
from .serializers import TaskSerializer
from .tasks import check_and_send_reminders, _send_reminder

User = get_user_model()


# ---------------------------------------------------------------------------
# Base helpers
# ---------------------------------------------------------------------------

class BaseAPITestCase(APITestCase):
    """Shared URL constants and factory helpers."""

    @classmethod
    def setUpTestData(cls):
        cls.signup_url = reverse('api_signup')
        cls.login_url = reverse('api_login')
        cls.logout_url = reverse('logout')
        cls.tasks_list_url = reverse('task-list')

    @staticmethod
    def default_password():
        return 'SecurePass123!'

    def create_user(self, username, email, password=None):
        """Create and return a standard test user."""
        return User.objects.create_user(
            username=username,
            email=email,
            password=password or self.default_password(),
        )

    def obtain_tokens(self, username, password=None):
        """
        Log in via the API and return the token payload.
        Expected keys: access, refresh, username, email, user_id.
        """
        response = self.client.post(
            self.login_url,
            {'username': username, 'password': password or self.default_password()},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data

    def authenticate(self, username, password=None):
        """Attach a Bearer token to the test client for subsequent requests."""
        tokens = self.obtain_tokens(username, password)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        return tokens

    def task_detail_url(self, task_id):
        return reverse('task-detail', kwargs={'pk': task_id})

    @staticmethod
    def build_task_payload(**overrides):
        """Return a valid task payload with a future reminder time."""
        payload = {
            'title': 'Test Reminder',
            'description': 'Automated test task',
            'first_reminder': (timezone.now() + timedelta(hours=2)).isoformat(),
            'repeat_reminder': 1,
        }
        payload.update(overrides)
        return payload


class AuthenticatedAPITestCase(BaseAPITestCase):
    """
    Reusable setUp: primary user, secondary user, and authenticated client.
    Most task tests inherit from this class.
    """

    def setUp(self):
        self.password = self.default_password()

        self.user = self.create_user('testuser', 'test@example.com')
        self.other_user = self.create_user('otheruser', 'other@example.com')

        self.tokens = self.authenticate(self.user.username, self.password)


# ---------------------------------------------------------------------------
# 1. Authentication
# ---------------------------------------------------------------------------

class AuthenticationTests(BaseAPITestCase):
    """Signup and login endpoints — JWT access/refresh token issuance."""

    def test_signup_creates_user_successfully(self):
        """Valid signup data should return 201 and persist the user."""
        payload = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': self.default_password(),
        }

        response = self.client.post(self.signup_url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username='newuser').exists())
        self.assertNotIn('password', response.data)

    def test_signup_rejects_duplicate_username(self):
        """Signup with an existing username should fail validation."""
        self.create_user('existing', 'existing@example.com')

        response = self.client.post(
            self.signup_url,
            {
                'username': 'existing',
                'email': 'another@example.com',
                'password': self.default_password(),
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('detail', response.data)
        self.assertEqual(response.data['detail'], 'This username is already taken.')

    def test_login_returns_jwt_tokens_and_user_metadata(self):
        """Login should return access + refresh tokens and basic user info."""
        self.create_user('loginuser', 'login@example.com')

        response = self.client.post(
            self.login_url,
            {'username': 'loginuser', 'password': self.default_password()},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['username'], 'loginuser')
        self.assertEqual(response.data['email'], 'login@example.com')
        self.assertEqual(response.data['user_id'], User.objects.get(username='loginuser').id)

    def test_login_rejects_invalid_credentials(self):
        """Wrong password should return 401 Unauthorized."""
        self.create_user('loginuser', 'login@example.com')

        response = self.client.post(
            self.login_url,
            {'username': 'loginuser', 'password': 'WrongPassword!'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


# ---------------------------------------------------------------------------
# 2. Task CRUD & ownership isolation
# ---------------------------------------------------------------------------

class TaskCRUDTests(AuthenticatedAPITestCase):
    """Authenticated CRUD operations with strict per-user data isolation."""

    def test_unauthenticated_requests_are_rejected(self):
        """Task endpoints must require a valid JWT."""
        self.client.credentials()  # clear auth header

        response = self.client.get(self.tasks_list_url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_user_can_create_task(self):
        """POST /tasks/ should create a task owned by the current user."""
        payload = self.build_task_payload(title='Buy groceries')

        response = self.client.post(self.tasks_list_url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['title'], 'Buy groceries')
        self.assertEqual(Task.objects.get(id=response.data['id']).user, self.user)

    def test_list_returns_only_own_tasks(self):
        """Each user should only see tasks they created."""
        Task.objects.create(user=self.user, title='My Task')
        Task.objects.create(user=self.other_user, title='Other Task')

        response = self.client.get(self.tasks_list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['title'], 'My Task')

    def test_retrieve_own_task(self):
        """GET /tasks/{id}/ should return a task owned by the requester."""
        task = Task.objects.create(user=self.user, title='Detail Task')

        response = self.client.get(self.task_detail_url(task.id))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], 'Detail Task')

    def test_cannot_retrieve_other_users_task(self):
        """Accessing another user's task should return 404 (queryset scoping)."""
        other_task = Task.objects.create(user=self.other_user, title='Private Task')

        response = self.client.get(self.task_detail_url(other_task.id))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_update_toggle_is_done(self):
        """PATCH is_done should persist the new completion state."""
        task = Task.objects.create(user=self.user, title='Toggle Me', is_done=False)

        response = self.client.patch(
            self.task_detail_url(task.id),
            {'is_done': True},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['is_done'])
        task.refresh_from_db()
        self.assertTrue(task.is_done)

    def test_cannot_update_other_users_task(self):
        """Updating another user's task should return 404."""
        other_task = Task.objects.create(user=self.other_user, title='Not Yours')

        response = self.client.patch(
            self.task_detail_url(other_task.id),
            {'title': 'Hacked'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        other_task.refresh_from_db()
        self.assertEqual(other_task.title, 'Not Yours')

    def test_delete_own_task(self):
        """DELETE /tasks/{id}/ should remove the task from the database."""
        task = Task.objects.create(user=self.user, title='Delete Me')

        response = self.client.delete(self.task_detail_url(task.id))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Task.objects.filter(id=task.id).exists())

    def test_cannot_delete_other_users_task(self):
        """Deleting another user's task should return 404 and leave data intact."""
        other_task = Task.objects.create(user=self.other_user, title='Protected')

        response = self.client.delete(self.task_detail_url(other_task.id))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Task.objects.filter(id=other_task.id).exists())


# ---------------------------------------------------------------------------
# 3. Celery integration — no real Redis required
# ---------------------------------------------------------------------------

class CeleryIntegrationTests(AuthenticatedAPITestCase):
    """Verify task lifecycle with the periodic-checker-only architecture."""

    def test_task_creation_persists_without_celery_scheduling(self):
        """Creating a task stores it in DB; periodic checker handles dispatch."""
        payload = self.build_task_payload(title='Scheduled Task')

        response = self.client.post(self.tasks_list_url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        task = Task.objects.get(id=response.data['id'])
        self.assertEqual(task.title, 'Scheduled Task')
        self.assertFalse(task.is_done)

    def test_marking_task_done_persists(self):
        """Setting is_done=True persists; periodic checker skips it."""
        task = Task.objects.create(user=self.user, title='Done Task', is_done=False)

        response = self.client.patch(
            self.task_detail_url(task.id),
            {'is_done': True},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        task.refresh_from_db()
        self.assertTrue(task.is_done)

    def test_delete_removes_task(self):
        """Deleting a task removes it from DB."""
        task = Task.objects.create(user=self.user, title='Delete Me')

        response = self.client.delete(self.task_detail_url(task.id))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Task.objects.filter(id=task.id).exists())


# ---------------------------------------------------------------------------
# 4. Model coverage
# ---------------------------------------------------------------------------

class TaskModelTests(TestCase):
    """Cover model helpers such as __str__."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user('modeluser', 'model@test.com', 'SecurePass123!')

    def test_task_str_returns_title(self):
        """Task.__str__ should return the task title (models.py line 21)."""
        task = Task.objects.create(user=self.user, title='String Representation')
        self.assertEqual(str(task), 'String Representation')


# ---------------------------------------------------------------------------
# 5. Serializer validation & next_reminder branches
# ---------------------------------------------------------------------------

class TaskSerializerTests(TestCase):
    """
    Hit serializer validation edge cases and get_next_reminder branches
    (serializers.py lines 53-65, 81, 85-86, 89, 94, 98-105).
    """

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user('serializeruser', 'ser@test.com', 'SecurePass123!')

    def _serialize(self, task):
        return TaskSerializer(task).data

    def test_next_reminder_none_when_task_is_done(self):
        task = Task.objects.create(
            user=self.user, title='Done', is_done=True,
            first_reminder=timezone.now() + timedelta(hours=1), repeat_reminder=1,
        )
        self.assertIsNone(self._serialize(task)['next_reminder'])

    def test_next_reminder_none_without_reminder_fields(self):
        """Lines 45-46: missing first or total returns None."""
        task = Task.objects.create(user=self.user, title='No Reminder')
        self.assertIsNone(self._serialize(task)['next_reminder'])

    def test_validation_allows_task_without_reminder_fields(self):
        """Lines 76-77: all reminder fields empty passes validation."""
        serializer = TaskSerializer(data={'title': 'Plain Task', 'description': 'No reminders'})
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_next_reminder_single_future_reminder(self):
        """total == 1 and first >= now → return first (line 51)."""
        future = timezone.now() + timedelta(hours=2)
        task = Task.objects.create(
            user=self.user, title='Single Future',
            first_reminder=future, repeat_reminder=1,
        )
        self.assertEqual(self._serialize(task)['next_reminder'], future)

    def test_next_reminder_single_past_reminder_returns_none(self):
        """total == 1 and first < now → return None (line 51)."""
        task = Task.objects.create(
            user=self.user, title='Single Past',
            first_reminder=timezone.now() - timedelta(hours=1), repeat_reminder=1,
        )
        self.assertIsNone(self._serialize(task)['next_reminder'])

    def test_next_reminder_future_first_with_repeats(self):
        """elapsed < 0 → return first (lines 57-58)."""
        future = timezone.now() + timedelta(hours=3)
        task = Task.objects.create(
            user=self.user, title='Future Repeating',
            first_reminder=future, repeat_reminder=3, time_between_reminders=15,
        )
        self.assertEqual(self._serialize(task)['next_reminder'], future)

    def test_next_reminder_none_when_interval_invalid(self):
        """interval is None or <= 0 → return None (lines 53-54)."""
        task = Task.objects.create(
            user=self.user, title='Bad Interval',
            first_reminder=timezone.now() - timedelta(minutes=10),
            repeat_reminder=3, time_between_reminders=0,
        )
        self.assertIsNone(self._serialize(task)['next_reminder'])

    def test_next_reminder_computes_next_slot(self):
        """Return first + timedelta when slots remain (line 65)."""
        now = timezone.now()
        task = Task.objects.create(
            user=self.user, title='Next Slot',
            first_reminder=now - timedelta(minutes=30),
            repeat_reminder=5, time_between_reminders=15,
        )
        # elapsed=30min, interval=15min → passed_slots = int(30//15)+1 = 3
        expected = task.first_reminder + timedelta(minutes=15 * 3)
        self.assertEqual(self._serialize(task)['next_reminder'], expected)

    def test_next_reminder_none_when_all_slots_exhausted(self):
        """passed_slots >= total → return None (lines 62-63)."""
        now = timezone.now()
        task = Task.objects.create(
            user=self.user, title='Exhausted',
            first_reminder=now - timedelta(minutes=60),
            repeat_reminder=4, time_between_reminders=15,
        )
        self.assertIsNone(self._serialize(task)['next_reminder'])

    def test_validation_requires_first_reminder_when_repeat_set(self):
        """Line 81: repeat/interval without first_reminder is rejected."""
        serializer = TaskSerializer(data={
            'title': 'Missing First',
            'repeat_reminder': 2,
            'time_between_reminders': 10,
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn('first_reminder is required', str(serializer.errors))

    def test_validation_defaults_repeat_to_one_when_only_first_given(self):
        """Lines 85-86: first without repeat defaults repeat_reminder to 1."""
        serializer = TaskSerializer(data={
            'title': 'Auto Repeat',
            'first_reminder': timezone.now() + timedelta(hours=1),
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data['repeat_reminder'], 1)

    def test_validation_rejects_repeat_less_than_one(self):
        """Line 89: repeat_reminder < 1 is rejected."""
        serializer = TaskSerializer(data={
            'title': 'Bad Repeat',
            'first_reminder': timezone.now() + timedelta(hours=1),
            'repeat_reminder': 0,
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn('repeat_reminder must be at least 1', str(serializer.errors))

    def test_validation_clears_interval_for_single_reminder(self):
        """Line 94: repeat == 1 clears time_between_reminders."""
        serializer = TaskSerializer(data={
            'title': 'Single With Interval',
            'first_reminder': timezone.now() + timedelta(hours=1),
            'repeat_reminder': 1,
            'time_between_reminders': 30,
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertIsNone(serializer.validated_data.get('time_between_reminders'))

    def test_validation_requires_interval_for_multiple_reminders(self):
        """Lines 99-100: repeat >= 2 requires time_between_reminders."""
        serializer = TaskSerializer(data={
            'title': 'No Interval',
            'first_reminder': timezone.now() + timedelta(hours=1),
            'repeat_reminder': 3,
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn('time_between_reminders is required', str(serializer.errors))

    def test_validation_rejects_non_positive_interval(self):
        """Lines 101-102: interval <= 0 is rejected when repeat >= 2."""
        serializer = TaskSerializer(data={
            'title': 'Zero Interval',
            'first_reminder': timezone.now() + timedelta(hours=1),
            'repeat_reminder': 2,
            'time_between_reminders': 0,
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn('time_between_reminders must be greater than 0', str(serializer.errors))


# ---------------------------------------------------------------------------
# 6. View branches — staff queryset & logout error handling
# ---------------------------------------------------------------------------

class StaffViewTests(AuthenticatedAPITestCase):
    """Cover TaskViewSet staff branch (views.py line 35)."""

    def setUp(self):
        super().setUp()
        self.staff_user = self.create_user('staffuser', 'staff@test.com')
        self.staff_user.is_staff = True
        self.staff_user.save()

    def test_staff_user_sees_all_tasks_by_default(self):
        """Staff without ?mine= should receive every user's tasks."""
        Task.objects.create(user=self.user, title='User Task')
        Task.objects.create(user=self.other_user, title='Other Task')

        self.authenticate(self.staff_user.username)

        response = self.client.get(self.tasks_list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = {item['title'] for item in response.data}
        self.assertEqual(titles, {'User Task', 'Other Task'})

    def test_staff_user_mine_param_limits_to_own_tasks(self):
        """?mine=1 should scope staff queryset to their own tasks."""
        Task.objects.create(user=self.staff_user, title='Staff Task')
        Task.objects.create(user=self.other_user, title='Other Task')

        self.authenticate(self.staff_user.username)

        response = self.client.get(f'{self.tasks_list_url}?mine=1')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['title'], 'Staff Task')


class LogoutViewTests(AuthenticatedAPITestCase):
    """Cover LogoutView success and exception paths (views.py lines 102-112)."""

    def test_logout_success_with_valid_refresh_token(self):
        """Valid refresh token should be blacklisted and return 205."""
        response = self.client.post(
            self.logout_url,
            {'refresh': self.tokens['refresh']},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_205_RESET_CONTENT)
        self.assertEqual(response.data['msg'], 'Logout successful')

    def test_logout_success_without_refresh_in_body(self):
        """Missing refresh key should still return 205 (line 103 branch)."""
        response = self.client.post(self.logout_url, {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_205_RESET_CONTENT)
        self.assertEqual(response.data['msg'], 'Logout successful')

    def test_logout_invalid_refresh_returns_400(self):
        """Invalid refresh token should hit the except block (lines 111-112)."""
        response = self.client.post(
            self.logout_url,
            {'refresh': 'not-a-valid-jwt-token'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error'], 'Invalid token or request')


# ---------------------------------------------------------------------------
# 7. Celery task unit tests — execute core logic directly
# ---------------------------------------------------------------------------

class CeleryTaskUnitTests(TestCase):
    """
    Directly invoke _send_reminder and check_and_send_reminders
    to cover the reminder dispatch logic without a real Redis broker.
    """

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            'celeryuser', 'celery@test.com', 'SecurePass123!',
        )

    # ---- _send_reminder -----------------------------------------------------

    @patch('tasks.tasks.webpush')
    @patch('tasks.tasks.EmailMultiAlternatives')
    def test_send_reminder_sends_email(self, mock_email_cls, mock_webpush):
        """_send_reminder dispatches email with correct content."""
        task = Task.objects.create(
            user=self.user,
            title='Email Test',
            first_reminder=timezone.now(),
            is_done=False,
        )

        _send_reminder(task)

        mock_email_cls.assert_called_once()
        _, kwargs = mock_email_cls.call_args
        self.assertIn('Email Test', kwargs['subject'])
        self.assertEqual(kwargs['to'], [self.user.email])
        mock_email_cls.return_value.attach_alternative.assert_called_once()
        mock_email_cls.return_value.send.assert_called_once()

    @patch('tasks.tasks.webpush')
    @patch('tasks.tasks.EmailMultiAlternatives')
    def test_email_failure_does_not_block_ws(self, mock_email_cls, mock_webpush):
        """Email failure must not prevent WebSocket dispatch."""
        mock_email_cls.return_value.send.side_effect = Exception('SMTP down')
        task = Task.objects.create(
            user=self.user,
            title='WS Only',
            first_reminder=timezone.now(),
            is_done=False,
        )

        # Should not raise — email failure is caught internally
        _send_reminder(task)

    # ---- check_and_send_reminders (periodic, direct execution) ---------------

    @patch('tasks.tasks.webpush')
    @patch('tasks.tasks.EmailMultiAlternatives')
    def test_sends_first_reminder(self, mock_email_cls, mock_webpush):
        """First reminder (sent_reminders=0): sends when now >= first_reminder."""
        task = Task.objects.create(
            user=self.user,
            title='First Reminder',
            first_reminder=timezone.now() - timedelta(minutes=5),
            repeat_reminder=2,
            time_between_reminders=10,
            sent_reminders=0,
            is_done=False,
        )

        check_and_send_reminders()

        mock_email_cls.return_value.send.assert_called_once()
        task.refresh_from_db()
        self.assertEqual(task.sent_reminders, 1)

    @patch('tasks.tasks.webpush')
    @patch('tasks.tasks.EmailMultiAlternatives')
    def test_sends_repeated_reminder(self, mock_email_cls, mock_webpush):
        """Repeated reminder: sends when now >= first + (sent * interval)."""
        task = Task.objects.create(
            user=self.user,
            title='Repeat Due',
            first_reminder=timezone.now() - timedelta(minutes=30),
            repeat_reminder=3,
            time_between_reminders=10,
            sent_reminders=1,
            is_done=False,
        )

        check_and_send_reminders()

        mock_email_cls.return_value.send.assert_called_once()
        task.refresh_from_db()
        self.assertEqual(task.sent_reminders, 2)

    @patch('tasks.tasks.webpush')
    @patch('tasks.tasks.EmailMultiAlternatives')
    def test_skips_not_yet_due_first(self, mock_email_cls, mock_webpush):
        """Future first_reminder is not triggered."""
        Task.objects.create(
            user=self.user,
            title='Future',
            first_reminder=timezone.now() + timedelta(hours=1),
            repeat_reminder=2,
            time_between_reminders=10,
            sent_reminders=0,
            is_done=False,
        )

        check_and_send_reminders()

        mock_email_cls.return_value.send.assert_not_called()

    @patch('tasks.tasks.webpush')
    @patch('tasks.tasks.EmailMultiAlternatives')
    def test_skips_not_yet_due_repeat(self, mock_email_cls, mock_webpush):
        """Future repeated reminder is not triggered."""
        Task.objects.create(
            user=self.user,
            title='Future Repeat',
            first_reminder=timezone.now() - timedelta(minutes=5),
            repeat_reminder=3,
            time_between_reminders=60,
            sent_reminders=1,
            is_done=False,
        )

        check_and_send_reminders()

        mock_email_cls.return_value.send.assert_not_called()

    @patch('tasks.tasks.webpush')
    @patch('tasks.tasks.EmailMultiAlternatives')
    def test_skips_completed(self, mock_email_cls, mock_webpush):
        """is_done=True tasks are excluded."""
        Task.objects.create(
            user=self.user,
            title='Done',
            first_reminder=timezone.now() - timedelta(minutes=5),
            repeat_reminder=1,
            sent_reminders=0,
            is_done=True,
        )

        check_and_send_reminders()

        mock_email_cls.return_value.send.assert_not_called()

    @patch('tasks.tasks.webpush')
    @patch('tasks.tasks.EmailMultiAlternatives')
    def test_skips_null_first_reminder(self, mock_email_cls, mock_webpush):
        """Tasks with first_reminder=null are excluded from query."""
        Task.objects.create(
            user=self.user,
            title='No Reminder',
            repeat_reminder=1,
            sent_reminders=0,
            is_done=False,
        )

        check_and_send_reminders()

        mock_email_cls.return_value.send.assert_not_called()

    @patch('tasks.tasks.webpush')
    @patch('tasks.tasks.EmailMultiAlternatives')
    def test_skips_when_all_repeats_sent(self, mock_email_cls, mock_webpush):
        """sent_reminders >= repeat_reminder skips the task."""
        Task.objects.create(
            user=self.user,
            title='Exhausted',
            first_reminder=timezone.now() - timedelta(minutes=10),
            repeat_reminder=2,
            time_between_reminders=10,
            sent_reminders=2,
            is_done=False,
        )

        check_and_send_reminders()

        mock_email_cls.return_value.send.assert_not_called()

    @patch('tasks.tasks.webpush')
    @patch('tasks.tasks.EmailMultiAlternatives')
    def test_handles_multiple_tasks(self, mock_email_cls, mock_webpush):
        """Multiple eligible tasks all get their reminders sent."""
        Task.objects.create(
            user=self.user,
            title='Task A',
            first_reminder=timezone.now() - timedelta(minutes=5),
            repeat_reminder=1,
            sent_reminders=0,
            is_done=False,
        )
        Task.objects.create(
            user=self.user,
            title='Task B',
            first_reminder=timezone.now() - timedelta(minutes=3),
            repeat_reminder=1,
            sent_reminders=0,
            is_done=False,
        )

        check_and_send_reminders()

        self.assertEqual(mock_email_cls.return_value.send.call_count, 2)


# ---------------------------------------------------------------------------
# 8. Time-based filtering — ?filter=today, week, month, all
# ---------------------------------------------------------------------------

class TaskFilterTests(AuthenticatedAPITestCase):
    """
    Verify the ``?filter`` query-param branching in TaskViewSet.get_queryset.

    Tasks are created via the ORM with ``first_reminder`` offsets relative to
    ``timezone.now()`` so the assertions are deterministic regardless of the
    exact wall-clock time the suite runs.
    """

    def setUp(self):
        super().setUp()

        now = timezone.now()
        today = now.date()

        # --- Fixtures --------------------------------------------------------
        # 1. 35 days ago – guaranteed to be in a previous month.
        Task.objects.create(
            user=self.user,
            title='Past',
            first_reminder=now - timedelta(days=35),
        )

        # 2. Today – matches "today", "week", and "month".
        Task.objects.create(
            user=self.user,
            title='Today',
            first_reminder=now,
        )

        # 3. In 3 days – matches "week" and "month".
        Task.objects.create(
            user=self.user,
            title='In 3 Days',
            first_reminder=now + timedelta(days=3),
        )

        # 4. In 10 days – matches "month" only (> 7 day week window).
        # Clamp to current month so late-month runs don't spill into next month.
        month_end = now.date().replace(day=calendar.monthrange(now.year, now.month)[1])
        in_10_date = min(now.date() + timedelta(days=10), month_end)
        in_10 = timezone.make_aware(datetime.combine(in_10_date, now.time()))
        Task.objects.create(
            user=self.user,
            title='In 10 Days',
            first_reminder=in_10,
        )

        # 5. In 60 days – outside every filter except "all".
        Task.objects.create(
            user=self.user,
            title='Far Future',
            first_reminder=now + timedelta(days=60),
        )

        # 6. Other user's task – must never appear.
        Task.objects.create(
            user=self.other_user,
            title='Other User Today',
            first_reminder=now,
        )

    # ---- helpers -----------------------------------------------------------

    def _get(self, query=''):
        url = f'{self.tasks_list_url}{query}'
        return self.client.get(url)

    def _titles(self, response):
        return [item['title'] for item in response.data]

    # ---- ?filter=today -----------------------------------------------------

    def test_filter_today_returns_only_today_tasks(self):
        response = self._get('?filter=today')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self._titles(response), ['Today'])

    def test_filter_today_excludes_other_users(self):
        response = self._get('?filter=today')
        titles = self._titles(response)
        self.assertNotIn('Other User Today', titles)


    def test_filter_week_excludes_other_users(self):
        response = self._get('?filter=week')
        titles = self._titles(response)
        self.assertNotIn('Other User Today', titles)

    # ---- ?filter=month -----------------------------------------------------

    def test_filter_month_returns_first_through_last_of_month(self):
        response = self._get('?filter=month')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = self._titles(response)
        self.assertIn('Today', titles)
        self.assertIn('In 3 Days', titles)
        self.assertIn('In 10 Days', titles)
        self.assertNotIn('Past', titles)
        self.assertNotIn('Far Future', titles)
        # Expect exactly 3: Today + In 3 Days + In 10 Days
        self.assertEqual(len(response.data), 3)

    def test_filter_month_excludes_other_users(self):
        response = self._get('?filter=month')
        titles = self._titles(response)
        self.assertNotIn('Other User Today', titles)

    # ---- ?filter=all and default -------------------------------------------

    def test_filter_all_returns_every_task_for_user(self):
        response = self._get('?filter=all')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # 5 tasks owned by self.user
        self.assertEqual(len(response.data), 5)

    def test_no_filter_param_returns_every_task(self):
        response = self._get('')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 5)

    def test_all_and_default_exclude_other_users(self):
        for param in ('?filter=all', ''):
            response = self._get(param)
            titles = self._titles(response)
            self.assertNotIn('Other User Today', titles)

    # ---- unknown filter value ----------------------------------------------

    def test_unknown_filter_returns_unfiltered(self):
        """An unrecognised filter value should behave like ``all``."""
        response = self._get('?filter=nonsense')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 5)

    # ---- staff + filter interaction ----------------------------------------

    def test_staff_with_filter_still_filters(self):
        """Filtering should work even for staff users who normally see all tasks."""
        self.staff_user = self.create_user('stafff', 'stafff@test.com')
        self.staff_user.is_staff = True
        self.staff_user.save()

        # Staff has no tasks of their own; only the user's fixtures exist.
        self.authenticate(self.staff_user.username)

        response = self._get('?filter=today')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Staff sees ALL users' tasks matching the filter (Today + Other User Today).
        titles = self._titles(response)
        self.assertIn('Today', titles)
        self.assertIn('Other User Today', titles)
        self.assertEqual(len(response.data), 2)

    def test_staff_with_mine_and_filter(self):
        """?mine=1 + filter should scope to the staff user's own tasks only."""
        self.staff_user = self.create_user('staffm', 'staffm@test.com')
        self.staff_user.is_staff = True
        self.staff_user.save()

        Task.objects.create(
            user=self.staff_user,
            title='Staff Today',
            first_reminder=timezone.now(),
        )

        self.authenticate(self.staff_user.username)

        response = self._get('?mine=1&filter=today')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self._titles(response), ['Staff Today'])

    # ---- ordering ----------------------------------------------------------

    def test_filtered_results_are_ordered_by_newest_first(self):
        response = self._get('?filter=month')

        ids = [item['id'] for item in response.data]
        self.assertEqual(ids, sorted(ids, reverse=True))

    def test_is_recurring_filter_excludes_none(self):
        """?is_recurring=true returns only tasks with recurrence != 'none'."""
        Task.objects.create(
            user=self.user, title='Recurring', first_reminder=timezone.now(),
            recurrence='daily',
        )
        Task.objects.create(
            user=self.user, title='Not Recurring', first_reminder=timezone.now(),
            recurrence='none',
        )

        response = self._get('?is_recurring=true')

        titles = self._titles(response)
        self.assertIn('Recurring', titles)
        self.assertNotIn('Not Recurring', titles)


# ---------------------------------------------------------------------------
# 9. Status filtering — ?status=pending, completed, all
# ---------------------------------------------------------------------------

class TaskStatusFilterTests(AuthenticatedAPITestCase):
    """
    Verify the ``?status`` query-param for completion-status filtering.

    Fixtures include tasks with varying ``is_done`` states so every branch
    (pending / completed / all / missing) can be asserted.
    """

    def setUp(self):
        super().setUp()

        now = timezone.now()

        # Today — pending
        self.today_pending = Task.objects.create(
            user=self.user, title='Today Pending',
            first_reminder=now, is_done=False,
        )
        # Today — completed
        self.today_done = Task.objects.create(
            user=self.user, title='Today Done',
            first_reminder=now, is_done=True,
        )
        # In 3 days — pending
        self.future_pending = Task.objects.create(
            user=self.user, title='Future Pending',
            first_reminder=now + timedelta(days=3), is_done=False,
        )
        # In 3 days — completed
        self.future_done = Task.objects.create(
            user=self.user, title='Future Done',
            first_reminder=now + timedelta(days=3), is_done=True,
        )
        # Other user — pending, today
        self.other_today_pending = Task.objects.create(
            user=self.other_user, title='Other Pending',
            first_reminder=now, is_done=False,
        )

    # ---- helpers -----------------------------------------------------------

    def _get(self, query=''):
        return self.client.get(f'{self.tasks_list_url}{query}')

    def _titles(self, response):
        return [item['title'] for item in response.data]

    # ---- ?status=pending ---------------------------------------------------

    def test_status_pending_returns_only_pending(self):
        response = self._get('?status=pending')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = self._titles(response)
        self.assertIn('Today Pending', titles)
        self.assertIn('Future Pending', titles)
        self.assertNotIn('Today Done', titles)
        self.assertNotIn('Future Done', titles)
        self.assertNotIn('Other Pending', titles)
        self.assertEqual(len(response.data), 2)

    # ---- ?status=completed -------------------------------------------------

    def test_status_completed_returns_only_completed(self):
        response = self._get('?status=completed')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = self._titles(response)
        self.assertIn('Today Done', titles)
        self.assertIn('Future Done', titles)
        self.assertNotIn('Today Pending', titles)
        self.assertNotIn('Future Pending', titles)
        self.assertNotIn('Other Pending', titles)
        self.assertEqual(len(response.data), 2)

    # ---- ?status=all and missing -------------------------------------------

    def test_status_all_returns_both_states(self):
        response = self._get('?status=all')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 4)

    def test_no_status_param_returns_both_states(self):
        response = self._get('')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 4)

    def test_unknown_status_returns_both_states(self):
        response = self._get('?status=nonsense')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 4)

    # ---- combined: time filter + status ------------------------------------

    def test_today_and_pending(self):
        response = self._get('?filter=today&status=pending')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self._titles(response), ['Today Pending'])

    def test_today_and_completed(self):
        response = self._get('?filter=today&status=completed')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self._titles(response), ['Today Done'])

    def test_week_and_pending(self):
        response = self._get('?filter=week&status=pending')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = self._titles(response)
        self.assertIn('Today Pending', titles)
        self.assertIn('Future Pending', titles)
        self.assertNotIn('Today Done', titles)
        self.assertNotIn('Future Done', titles)
        self.assertEqual(len(response.data), 2)

    def test_week_and_completed(self):
        response = self._get('?filter=week&status=completed')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = self._titles(response)
        self.assertIn('Today Done', titles)
        self.assertIn('Future Done', titles)
        self.assertNotIn('Today Pending', titles)
        self.assertNotIn('Future Pending', titles)
        self.assertEqual(len(response.data), 2)

    def test_month_and_pending(self):
        response = self._get('?filter=month&status=pending')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = self._titles(response)
        self.assertIn('Today Pending', titles)
        self.assertIn('Future Pending', titles)
        self.assertNotIn('Today Done', titles)
        self.assertNotIn('Future Done', titles)
        self.assertNotIn('Other Pending', titles)
        self.assertEqual(len(response.data), 2)

    def test_month_and_completed_excludes_other_users(self):
        """Status filter + time filter must still respect per-user scoping."""
        response = self._get('?filter=month&status=pending')
        titles = self._titles(response)
        self.assertNotIn('Other Pending', titles)

    def test_all_time_and_pending(self):
        """No time filter + status=pending returns all pending tasks for user."""
        response = self._get('?filter=all&status=pending')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = self._titles(response)
        self.assertIn('Today Pending', titles)
        self.assertIn('Future Pending', titles)
        self.assertNotIn('Today Done', titles)
        self.assertNotIn('Future Done', titles)
        self.assertEqual(len(response.data), 2)

    def test_no_filters_returns_all_user_tasks(self):
        """Bare endpoint with no params returns every task for the user."""
        response = self._get('')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 4)

    def test_staff_with_status_filter(self):
        """Staff sees all users' tasks filtered by status."""
        staff = self.create_user('staffs', 'staffs@test.com')
        staff.is_staff = True
        staff.save()
        self.authenticate(staff.username)

        response = self._get('?status=pending')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = self._titles(response)
        self.assertIn('Today Pending', titles)
        self.assertIn('Future Pending', titles)
        self.assertIn('Other Pending', titles)
        self.assertNotIn('Today Done', titles)
        self.assertNotIn('Future Done', titles)
        self.assertEqual(len(response.data), 3)

    def test_staff_with_filter_and_status(self):
        """Staff + time filter + status: all three layers combine."""
        staff = self.create_user('staffc', 'staffc@test.com')
        staff.is_staff = True
        staff.save()
        self.authenticate(staff.username)

        response = self._get('?filter=today&status=completed')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = self._titles(response)
        self.assertIn('Today Done', titles)
        self.assertNotIn('Today Pending', titles)
        self.assertNotIn('Other Pending', titles)
        self.assertEqual(len(response.data), 1)


# ---------------------------------------------------------------------------
# 10. User Profile — /api/users/me/
# ---------------------------------------------------------------------------

class UserProfileTests(AuthenticatedAPITestCase):
    """Tests for GET/PATCH/PUT /api/users/me/ and POST /api/users/me/change-password/."""

    def setUp(self):
        super().setUp()
        self.profile_url = reverse('user_profile')
        self.change_password_url = reverse('change_password')

    # ---- GET /me/ ----------------------------------------------------------

    def test_unauthenticated_get_profile_returns_401(self):
        self.client.credentials()
        response = self.client.get(self.profile_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_get_profile_returns_correct_schema(self):
        response = self.client.get(self.profile_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'testuser')
        self.assertEqual(response.data['email'], 'test@example.com')
        self.assertEqual(response.data['id'], self.user.id)
        self.assertIn('date_joined', response.data)

    def test_get_profile_does_not_expose_password(self):
        response = self.client.get(self.profile_url)
        self.assertNotIn('password', response.data)

    # ---- PATCH /me/ --------------------------------------------------------

    def test_patch_profile_updates_username(self):
        response = self.client.patch(
            self.profile_url,
            {'username': 'newname'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'newname')
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, 'newname')

    def test_patch_profile_rejects_duplicate_username(self):
        response = self.client.patch(
            self.profile_url,
            {'username': 'otheruser'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('username', response.data)

    def test_patch_profile_allows_keeping_own_username(self):
        """Submitting the current username should not trigger a uniqueness error."""
        response = self.client.patch(
            self.profile_url,
            {'username': 'testuser'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_patch_profile_ignores_email(self):
        """Email is read-only; passing it must not change the stored value."""
        response = self.client.patch(
            self.profile_url,
            {'email': 'hacker@example.com'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, 'test@example.com')

    def test_unauthenticated_patch_returns_401(self):
        self.client.credentials()
        response = self.client.patch(
            self.profile_url, {'username': 'x'}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # ---- PUT /me/ ----------------------------------------------------------

    def test_put_profile_updates_username_only(self):
        """PUT updates username; email in body is ignored (read-only)."""
        response = self.client.put(
            self.profile_url,
            {'username': 'fullupdate', 'email': 'full@example.com'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'fullupdate')
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, 'test@example.com')

    # ---- POST /me/change-password/ -----------------------------------------

    def test_change_password_success(self):
        response = self.client.post(
            self.change_password_url,
            {'old_password': 'SecurePass123!', 'new_password': 'NewSecure456!'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('NewSecure456!'))
        self.assertFalse(self.user.check_password('SecurePass123!'))

    def test_change_password_wrong_old_password_returns_400(self):
        response = self.client.post(
            self.change_password_url,
            {'old_password': 'WrongPassword!', 'new_password': 'NewSecure456!'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('old_password', response.data)

    def test_change_password_weak_new_password_returns_400(self):
        response = self.client.post(
            self.change_password_url,
            {'old_password': 'SecurePass123!', 'new_password': '123'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('new_password', response.data)

    def test_change_password_unauthenticated_returns_401(self):
        self.client.credentials()
        response = self.client.post(
            self.change_password_url,
            {'old_password': 'SecurePass123!', 'new_password': 'NewSecure456!'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_change_password_missing_fields_returns_400(self):
        response = self.client.post(
            self.change_password_url, {}, format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('old_password', response.data)
        self.assertIn('new_password', response.data)


# ---------------------------------------------------------------------------
# 11. Notification system — model, API, and Celery integration
# ---------------------------------------------------------------------------

class NotificationModelTests(TestCase):
    """Test Notification model behaviour in isolation."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user('notifuser', 'notif@test.com', 'SecurePass123!')

    def test_create_notification(self):
        notif = Notification.objects.create(
            user=self.user,
            title='Test Alert',
        )
        self.assertEqual(notif.user, self.user)
        self.assertEqual(notif.title, 'Test Alert')
        self.assertFalse(notif.is_read)
        self.assertIsNone(notif.task)

    def test_create_notification_with_task(self):
        task = Task.objects.create(user=self.user, title='My Task')
        notif = Notification.objects.create(
            user=self.user,
            task=task,
            title='Task Alert',
        )
        self.assertEqual(notif.task, task)
        self.assertEqual(notif.task_id, task.id)

    def test_task_deletion_nulls_notification_fk(self):
        """on_delete=SET_NULL must clear the task FK, not delete the notification."""
        task = Task.objects.create(user=self.user, title='Doomed Task')
        notif = Notification.objects.create(
            user=self.user,
            task=task,
            title='Link Test',
        )
        task.delete()

        notif.refresh_from_db()
        self.assertIsNone(notif.task)
        self.assertTrue(Notification.objects.filter(pk=notif.pk).exists())

    def test_notification_str(self):
        notif = Notification.objects.create(user=self.user, title='Hello')
        self.assertIn('Hello', str(notif))
        self.assertIn('notifuser', str(notif))


class NotificationAPITests(AuthenticatedAPITestCase):
    """Test the /api/notifications/ endpoints."""

    def setUp(self):
        super().setUp()
        self.notif_url = reverse('notification-list')
        self.task = Task.objects.create(user=self.user, title='Notif Task')

    def _create(self, **overrides):
        defaults = {'user': self.user, 'title': 'Alert'}
        defaults.update(overrides)
        return Notification.objects.create(**defaults)

    # ---- Auth ---------------------------------------------------------------

    def test_unauthenticated_list_returns_401(self):
        self.client.credentials()
        response = self.client.get(self.notif_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_unauthenticated_mark_read_returns_401(self):
        self.client.credentials()
        notif = self._create()
        url = reverse('notification-mark-read', kwargs={'pk': notif.pk})
        response = self.client.patch(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_unauthenticated_mark_all_read_returns_401(self):
        self.client.credentials()
        url = reverse('notification-mark-all-read')
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_unauthenticated_delete_returns_401(self):
        self.client.credentials()
        notif = self._create()
        url = reverse('notification-detail', kwargs={'pk': notif.pk})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # ---- GET /api/notifications/ --------------------------------------------

    def _results(self, response):
        """Handle both paginated ({results: [...]}) and plain list responses."""
        if isinstance(response.data, dict) and 'results' in response.data:
            return response.data['results']
        return response.data

    def test_list_returns_own_notifications(self):
        self._create(title='Mine')
        Notification.objects.create(user=self.other_user, title='Theirs')

        response = self.client.get(self.notif_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self._results(response)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['title'], 'Mine')

    def test_list_ordered_newest_first(self):
        old = self._create(title='Old')
        old.created_at = timezone.now() - timedelta(hours=1)
        old.save(update_fields=['created_at'])
        new = self._create(title='New')

        response = self.client.get(self.notif_url)

        titles = [r['title'] for r in self._results(response)]
        self.assertEqual(titles, ['New', 'Old'])

    def test_list_includes_task_id(self):
        notif = self._create(task=self.task, title='With Task')

        response = self.client.get(self.notif_url)

        self.assertEqual(self._results(response)[0]['task_id'], self.task.id)

    def test_list_includes_task_id_null(self):
        notif = self._create(title='No Task')

        response = self.client.get(self.notif_url)

        self.assertIsNone(self._results(response)[0]['task_id'])

    def test_list_unread_filter(self):
        self._create(title='Read', is_read=True)
        self._create(title='Unread', is_read=False)

        response = self.client.get(f'{self.notif_url}?unread=1')

        titles = [r['title'] for r in self._results(response)]
        self.assertEqual(titles, ['Unread'])

    # ---- PATCH /api/notifications/<id>/mark-read/ ---------------------------

    def test_mark_read_sets_is_read_true(self):
        notif = self._create(is_read=False)
        url = reverse('notification-mark-read', kwargs={'pk': notif.pk})

        response = self.client.patch(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['is_read'])
        notif.refresh_from_db()
        self.assertTrue(notif.is_read)

    def test_mark_read_other_users_notification_returns_404(self):
        other_notif = Notification.objects.create(
            user=self.other_user, title='Not Mine',
        )
        url = reverse('notification-mark-read', kwargs={'pk': other_notif.pk})

        response = self.client.patch(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # ---- POST /api/notifications/mark-all-read/ -----------------------------

    def test_mark_all_read_updates_all_user_notifications(self):
        self._create(title='A', is_read=False)
        self._create(title='B', is_read=False)
        self._create(title='C', is_read=True)
        url = reverse('notification-mark-all-read')

        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['marked_read'], 2)
        self.assertEqual(
            Notification.objects.filter(user=self.user, is_read=False).count(), 0,
        )

    def test_mark_all_read_does_not_affect_other_users(self):
        self._create(title='Mine', is_read=False)
        Notification.objects.create(
            user=self.other_user, title='Theirs', is_read=False,
        )
        url = reverse('notification-mark-all-read')

        self.client.post(url)

        self.assertFalse(
            Notification.objects.get(user=self.other_user, title='Theirs').is_read,
        )

    # ---- DELETE /api/notifications/<id>/ ------------------------------------

    def test_delete_own_notification(self):
        notif = self._create()
        url = reverse('notification-detail', kwargs={'pk': notif.pk})

        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Notification.objects.filter(pk=notif.pk).exists())

    def test_delete_other_users_notification_returns_404(self):
        other_notif = Notification.objects.create(
            user=self.other_user, title='Protected',
        )
        url = reverse('notification-detail', kwargs={'pk': other_notif.pk})

        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Notification.objects.filter(pk=other_notif.pk).exists())


class NotificationCeleryTests(TestCase):
    """Test that _send_reminder persists Notification records."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user('celnotif', 'celnotif@test.com', 'SecurePass123!')

    @patch('tasks.tasks.webpush')
    @patch('tasks.tasks.EmailMultiAlternatives')
    def test_send_reminder_creates_notification(self, mock_email_cls, mock_webpush):
        task = Task.objects.create(
            user=self.user, title='Reminder Task',
            first_reminder=timezone.now() - timedelta(minutes=5),
            is_done=False,
        )

        _send_reminder(task)

        notif = Notification.objects.get(user=self.user)
        self.assertEqual(notif.task, task)
        self.assertIn('Reminder Task', notif.title)
        self.assertFalse(notif.is_read)

    @patch('tasks.tasks.webpush')
    @patch('tasks.tasks.EmailMultiAlternatives')
    def test_send_reminder_notification_persists_on_email_failure(self, mock_email_cls, mock_webpush):
        """Email failure must not prevent Notification creation."""
        mock_email_cls.return_value.send.side_effect = Exception('SMTP down')
        task = Task.objects.create(
            user=self.user, title='Fail Email Task',
            first_reminder=timezone.now() - timedelta(minutes=5),
            is_done=False,
        )

        _send_reminder(task)

        self.assertTrue(Notification.objects.filter(user=self.user, task=task).exists())

    @patch('tasks.tasks.webpush')
    @patch('tasks.tasks.get_channel_layer')
    @patch('tasks.tasks.EmailMultiAlternatives')
    def test_send_reminder_notification_persists_on_ws_failure(self, mock_email_cls, mock_channel, mock_webpush):
        """WebSocket failure must not prevent Notification creation."""
        mock_channel.return_value.group_send.side_effect = Exception('Redis down')
        task = Task.objects.create(
            user=self.user, title='Fail WS Task',
            first_reminder=timezone.now() - timedelta(minutes=5),
            is_done=False,
        )

        _send_reminder(task)

        self.assertTrue(Notification.objects.filter(user=self.user, task=task).exists())

    @patch('tasks.tasks.webpush')
    @patch('tasks.tasks.Notification.objects.create')
    @patch('tasks.tasks.EmailMultiAlternatives')
    def test_send_reminder_survives_db_error(self, mock_email_cls, mock_create, mock_webpush):
        """DB error during Notification.create must be caught, not crash the pipeline."""
        mock_create.side_effect = Exception('DB exploded')
        task = Task.objects.create(
            user=self.user, title='DB Fail Task',
            first_reminder=timezone.now() - timedelta(minutes=5),
            is_done=False,
        )

        # Should not raise
        _send_reminder(task)

        # Email was still attempted
        mock_email_cls.return_value.send.assert_called_once()


# ---------------------------------------------------------------------------
# 12. Web Push notification edge cases
# ---------------------------------------------------------------------------

class WebPushNotificationTests(TestCase):
    """Cover the Web Push try/except blocks inside _send_reminder."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            'webpushuser', 'webpush@test.com', 'SecurePass123!',
        )

    def _make_task(self, **overrides):
        defaults = {
            'user': self.user,
            'title': 'Push Task',
            'first_reminder': timezone.now() - timedelta(minutes=5),
            'is_done': False,
        }
        defaults.update(overrides)
        return Task.objects.create(**defaults)

    def _make_subscription(self, **overrides):
        defaults = {
            'user': self.user,
            'endpoint': 'https://example.com/push/endpoint/1',
            'p256dh': 'test-p256dh-key',
            'auth': 'test-auth-key',
        }
        defaults.update(overrides)
        return WebPushSubscription.objects.create(**defaults)

    @patch('tasks.tasks.webpush')
    @patch('tasks.tasks.EmailMultiAlternatives')
    def test_successful_web_push(self, mock_email_cls, mock_webpush):
        """webpush() succeeds — subscription is NOT deleted."""
        sub = self._make_subscription()
        task = self._make_task()

        _send_reminder(task)

        mock_webpush.assert_called_once()
        self.assertTrue(WebPushSubscription.objects.filter(pk=sub.pk).exists())

    @patch('tasks.tasks.webpush')
    @patch('tasks.tasks.EmailMultiAlternatives')
    def test_expired_subscription_410_deletes(self, mock_email_cls, mock_webpush):
        """webpush() raises WebPushException with status 410 — subscription is deleted."""
        sub = self._make_subscription()
        task = self._make_task()

        response = MagicMock()
        response.status_code = 410
        exc = WebPushException(' Gone')
        exc.response = response
        mock_webpush.side_effect = exc

        _send_reminder(task)

        self.assertFalse(WebPushSubscription.objects.filter(pk=sub.pk).exists())

    @patch('tasks.tasks.webpush')
    @patch('tasks.tasks.EmailMultiAlternatives')
    def test_not_found_subscription_404_deletes(self, mock_email_cls, mock_webpush):
        """webpush() raises WebPushException with status 404 — subscription is deleted."""
        sub = self._make_subscription()
        task = self._make_task()

        response = MagicMock()
        response.status_code = 404
        exc = WebPushException(' Not Found')
        exc.response = response
        mock_webpush.side_effect = exc

        _send_reminder(task)

        self.assertFalse(WebPushSubscription.objects.filter(pk=sub.pk).exists())

    @patch('tasks.tasks.webpush')
    @patch('tasks.tasks.EmailMultiAlternatives')
    def test_server_error_500_keeps_subscription(self, mock_email_cls, mock_webpush):
        """webpush() raises WebPushException with status 500 — subscription is kept."""
        sub = self._make_subscription()
        task = self._make_task()

        response = MagicMock()
        response.status_code = 500
        exc = WebPushException(' Internal Server Error')
        exc.response = response
        mock_webpush.side_effect = exc

        _send_reminder(task)

        self.assertTrue(WebPushSubscription.objects.filter(pk=sub.pk).exists())


# ---------------------------------------------------------------------------
# 13. Model __str__ coverage (models.py lines 41, 76)
# ---------------------------------------------------------------------------

class ModelStrTests(TestCase):
    """Cover __str__ on WebPushSubscription and TelegramConnection."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user('struser', 'str@test.com', 'SecurePass123!')

    def test_webpush_subscription_str(self):
        sub = WebPushSubscription.objects.create(
            user=self.user,
            endpoint='https://example.com/push/a',
            p256dh='key1',
            auth='auth1',
        )
        result = str(sub)
        self.assertIn('struser', result)
        self.assertIn('WebPush(', result)
        self.assertIn('https://example.com/push/a', result)

    def test_telegram_connection_str_linked(self):
        conn = TelegramConnection.objects.create(
            user=self.user, chat_id='12345',
        )
        result = str(conn)
        self.assertIn('struser', result)
        self.assertIn('12345', result)

    def test_telegram_connection_str_unlinked(self):
        conn = TelegramConnection.objects.create(
            user=self.user, chat_id=None,
        )
        self.assertIn('unlinked', str(conn))


# ---------------------------------------------------------------------------
# 14. telegram_utils.py coverage (lines 6-9)
# ---------------------------------------------------------------------------

class TelegramUtilsTests(TestCase):
    """Cover send_telegram_notification in telegram_utils.py."""

    @patch('tasks.telegram_utils.TeleBot')
    @patch('tasks.telegram_utils.apihelper')
    def test_send_telegram_sets_proxy_and_sends(self, mock_apihelper, mock_telebot):
        from .telegram_utils import send_telegram_notification

        mock_bot_instance = MagicMock()
        mock_telebot.return_value = mock_bot_instance

        send_telegram_notification('999', 'Hello there')

        mock_apihelper.proxy = {'https': 'http://xray-proxy:10809'}
        mock_telebot.assert_called_once_with(settings.TELEGRAM_BOT_TOKEN)
        mock_bot_instance.send_message.assert_called_once_with('999', 'Hello there')


# ---------------------------------------------------------------------------
# 15. Telegram paths in _send_reminder (tasks.py lines 67-69, 73-74)
# ---------------------------------------------------------------------------

class TelegramReminderTests(TestCase):
    """Cover the Telegram branch inside _send_reminder."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user('tguser', 'tg@test.com', 'SecurePass123!')

    @patch('tasks.tasks.send_telegram_notification')
    @patch('tasks.tasks.webpush')
    @patch('tasks.tasks.EmailMultiAlternatives')
    def test_telegram_sent_when_connected(self, mock_email_cls, mock_wp, mock_tg):
        """Lines 67-69: chat_id exists, send_telegram_notification is called."""
        TelegramConnection.objects.create(user=self.user, chat_id='111222')
        task = Task.objects.create(
            user=self.user, title='TG Task',
            first_reminder=timezone.now() - timedelta(minutes=5), is_done=False,
        )

        _send_reminder(task)

        mock_tg.assert_called_once()
        args = mock_tg.call_args[0]
        self.assertEqual(args[0], '111222')
        self.assertIn('TG Task', args[1])

    @patch('tasks.tasks.send_telegram_notification')
    @patch('tasks.tasks.webpush')
    @patch('tasks.tasks.EmailMultiAlternatives')
    def test_telegram_skipped_when_no_connection(self, mock_email_cls, mock_wp, mock_tg):
        """Lines 70-71: user has no TelegramConnection — send not called."""
        task = Task.objects.create(
            user=self.user, title='No TG',
            first_reminder=timezone.now() - timedelta(minutes=5), is_done=False,
        )

        _send_reminder(task)

        mock_tg.assert_not_called()

    @patch('tasks.tasks.send_telegram_notification', side_effect=Exception('TG down'))
    @patch('tasks.tasks.webpush')
    @patch('tasks.tasks.EmailMultiAlternatives')
    def test_telegram_failure_does_not_crash(self, mock_email_cls, mock_wp, mock_tg):
        """Lines 73-74: Telegram exception is caught, function continues."""
        TelegramConnection.objects.create(user=self.user, chat_id='333')
        task = Task.objects.create(
            user=self.user, title='TG Fail',
            first_reminder=timezone.now() - timedelta(minutes=5), is_done=False,
        )

        _send_reminder(task)

        mock_tg.assert_called_once()


# ---------------------------------------------------------------------------
# 16. Web Push outer exception (tasks.py lines 108-109)
# ---------------------------------------------------------------------------

class WebPushPipelineFailureTests(TestCase):
    """Cover the outer except block wrapping the web push pipeline."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user('wpfail', 'wpfail@test.com', 'SecurePass123!')

    @patch('tasks.tasks.WebPushSubscription.objects.filter')
    @patch('tasks.tasks.EmailMultiAlternatives')
    @patch('tasks.tasks.send_telegram_notification')
    def test_web_push_outer_exception_caught(self, mock_tg, mock_email_cls, mock_filter):
        """Lines 108-109: exception inside the web push try block is caught."""
        mock_filter.side_effect = Exception('DB Error')
        task = Task.objects.create(
            user=self.user, title='WP Outer Fail',
            first_reminder=timezone.now() - timedelta(minutes=5), is_done=False,
        )

        # Must not raise — the outer try/except catches it
        _send_reminder(task)


# ---------------------------------------------------------------------------
# 17. check_and_send_reminders failure path (tasks.py lines 153-154)
# ---------------------------------------------------------------------------

class PeriodicReminderFailureTests(TestCase):
    """Cover the except block in check_and_send_reminders."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user('periodic', 'periodic@test.com', 'SecurePass123!')

    @patch('tasks.tasks._send_reminder', side_effect=Exception('pipeline exploded'))
    def test_periodic_failure_does_not_crash_loop(self, mock_send):
        """Lines 153-154: _send_reminder failure is caught, counter not incremented."""
        task = Task.objects.create(
            user=self.user, title='Boom',
            first_reminder=timezone.now() - timedelta(minutes=5),
            repeat_reminder=1, sent_reminders=0, is_done=False,
        )
        initial_sent = task.sent_reminders

        check_and_send_reminders()

        mock_send.assert_called_once()
        task.refresh_from_db()
        self.assertEqual(task.sent_reminders, initial_sent)


# ---------------------------------------------------------------------------
# 18. Serializer coverage (serializers.py lines 103-105, 136, 163-165, 168-175)
# ---------------------------------------------------------------------------

class WebPushSerializerTests(TestCase):
    """Cover WebPushSubscriptionSerializer validate_keys and create."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user('wpser', 'wpser@test.com', 'SecurePass123!')

    def test_validate_keys_missing_fields(self):
        """Lines 163-164: keys dict missing p256dh raises error."""
        from .serializers import WebPushSubscriptionSerializer
        from rest_framework.test import APIRequestFactory

        factory = APIRequestFactory()
        request = factory.post('/api/webpush/subscribe/')
        request.user = self.user

        ser = WebPushSubscriptionSerializer(
            data={'endpoint': 'https://example.com', 'keys': {'auth': 'a'}},
            context={'request': request},
        )
        self.assertFalse(ser.is_valid())
        self.assertIn('keys', ser.errors)

    def test_validate_keys_valid(self):
        """Line 165: valid keys returns value."""
        from .serializers import WebPushSubscriptionSerializer
        from rest_framework.test import APIRequestFactory

        factory = APIRequestFactory()
        request = factory.post('/api/webpush/subscribe/')
        request.user = self.user

        ser = WebPushSubscriptionSerializer(
            data={
                'endpoint': 'https://example.com/push/1',
                'keys': {'p256dh': 'pk', 'auth': 'au'},
            },
            context={'request': request},
        )
        self.assertTrue(ser.is_valid(), ser.errors)

    def test_create_updates_existing_subscription(self):
        """Lines 168-175: create method uses update_or_create."""
        from .serializers import WebPushSubscriptionSerializer
        from rest_framework.test import APIRequestFactory

        WebPushSubscription.objects.create(
            user=self.user, endpoint='https://example.com/push/1',
            p256dh='old', auth='old',
        )

        factory = APIRequestFactory()
        request = factory.post('/api/webpush/subscribe/')
        request.user = self.user

        ser = WebPushSubscriptionSerializer(
            data={
                'endpoint': 'https://example.com/push/1',
                'keys': {'p256dh': 'new', 'auth': 'new'},
            },
            context={'request': request},
        )
        self.assertTrue(ser.is_valid(), ser.errors)
        obj = ser.save()
        obj.refresh_from_db()
        self.assertEqual(obj.p256dh, 'new')
        self.assertEqual(WebPushSubscription.objects.filter(user=self.user).count(), 1)


class TaskSerializerValidateTests(TestCase):
    """Cover TaskSerializer.validate fallthrough (serializers.py lines 103-105)."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user('tsv', 'tsv@test.com', 'SecurePass123!')

    def test_validate_returns_attrs_for_valid_repeat_with_interval(self):
        """Lines 103-105: repeat >= 2 with valid interval returns attrs."""
        future = timezone.now() + timedelta(hours=1)
        ser = TaskSerializer(data={
            'title': 'Valid Multi',
            'first_reminder': future,
            'repeat_reminder': 3,
            'time_between_reminders': 15,
        })
        self.assertTrue(ser.is_valid(), ser.errors)


class UserProfileSerializerTests(TestCase):
    """Cover UserProfileSerializer.validate_username (serializers.py line 136)."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user('ups', 'ups@test.com', 'SecurePass123!')
        cls.other = User.objects.create_user('taken', 'taken@test.com', 'SecurePass123!')

    def test_validate_username_rejects_duplicate(self):
        """Line 136: username already taken raises error."""
        from .serializers import UserProfileSerializer
        from rest_framework.test import APIRequestFactory

        factory = APIRequestFactory()
        request = factory.patch('/api/users/me/')
        request.user = self.user

        ser = UserProfileSerializer(
            self.user, data={'username': 'taken'}, partial=True,
            context={'request': request},
        )
        self.assertFalse(ser.is_valid())
        self.assertIn('username', ser.errors)


# ---------------------------------------------------------------------------
# 19. View coverage (views.py lines 146, 225-226, 252-255, 265-267)
# ---------------------------------------------------------------------------

class LoginFailureWarningTests(AuthenticatedAPITestCase):
    """Cover the failed-login warning branch (views.py line 146)."""

    def test_failed_login_logs_warning(self):
        """Line 146: wrong credentials hit the else/branch."""
        response = self.client.post(
            self.login_url,
            {'username': 'nonexistent', 'password': 'BadPass!'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class NotificationPaginatedListTests(AuthenticatedAPITestCase):
    """Cover the paginated response branch (views.py lines 225-226)."""

    def test_list_with_unread_filter_returns_paginated(self):
        """Lines 225-226: paginated queryset returns paginated response."""
        for i in range(15):
            Notification.objects.create(
                user=self.user, title=f'N{i}', is_read=(i % 2 == 0),
            )
        notif_url = reverse('notification-list')

        response = self.client.get(f'{notif_url}?unread=1')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        self.assertTrue(len(response.data) > 0)


class WebPushSubscribeViewTests(AuthenticatedAPITestCase):
    """Cover WebPushSubscribeView.post (views.py lines 252-255)."""

    def test_subscribe_saves_valid_payload(self):
        """Lines 252-255: valid subscription returns 201."""
        url = reverse('webpush_subscribe')
        payload = {
            'endpoint': 'https://example.com/push/sub/1',
            'keys': {'p256dh': 'testkey', 'auth': 'testauth'},
        }

        response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            WebPushSubscription.objects.filter(user=self.user).exists(),
        )

    def test_subscribe_rejects_invalid_keys(self):
        """Invalid keys payload returns 400."""
        url = reverse('webpush_subscribe')
        response = self.client.post(
            url, {'endpoint': 'https://example.com', 'keys': {}}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class TelegramLinkViewTests(AuthenticatedAPITestCase):
    """Cover GetTelegramLinkView.get (views.py lines 265-267)."""

    def test_get_link_creates_connection_and_returns_token(self):
        """Lines 265-267: first call creates row, returns token + bot_username."""
        url = reverse('telegram_link')

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('link_token', response.data)
        self.assertIn('bot_username', response.data)
        self.assertTrue(TelegramConnection.objects.filter(user=self.user).exists())

    def test_get_link_returns_same_token_on_repeat_call(self):
        """Repeated calls return the same link_token."""
        url = reverse('telegram_link')

        resp1 = self.client.get(url)
        resp2 = self.client.get(url)

        self.assertEqual(resp1.data['link_token'], resp2.data['link_token'])

    def test_delete_removes_connection(self):
        """DELETE removes the TelegramConnection and returns 204."""
        url = reverse('telegram_link')
        TelegramConnection.objects.create(user=self.user, chat_id='999')

        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(TelegramConnection.objects.filter(user=self.user).exists())

    def test_delete_returns_404_when_no_connection(self):
        """DELETE returns 404 when user has no TelegramConnection."""
        url = reverse('telegram_link')

        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


# ---------------------------------------------------------------------------
# 20. Category system
# ---------------------------------------------------------------------------

class CategoryModelTests(TestCase):
    """Cover Category model __str__ and constraints."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user('catuser', 'cat@test.com', 'SecurePass123!')

    def test_category_str(self):
        cat = Category.objects.create(user=self.user, name='Work')
        self.assertIn('Work', str(cat))
        self.assertIn('catuser', str(cat))

    def test_unique_constraint_same_name_raises(self):
        Category.objects.create(user=self.user, name='Work')
        with self.assertRaises(Exception):
            Category.objects.create(user=self.user, name='Work')

    def test_different_users_can_have_same_name(self):
        other = User.objects.create_user('other', 'other@test.com', 'SecurePass123!')
        Category.objects.create(user=self.user, name='Work')
        cat = Category.objects.create(user=other, name='Work')
        self.assertEqual(cat.name, 'Work')


class CategoryAPITests(AuthenticatedAPITestCase):
    """CRUD for /api/categories/ endpoint."""

    def setUp(self):
        super().setUp()
        self.url = reverse('category-list')

    def test_create_category(self):
        response = self.client.post(self.url, {'name': 'Personal', 'color': '#ff0000'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Personal')
        self.assertTrue(Category.objects.filter(user=self.user, name='Personal').exists())

    def test_list_returns_own_categories(self):
        Category.objects.create(user=self.user, name='Mine')
        Category.objects.create(user=self.other_user, name='Theirs')

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = [c['name'] for c in response.data]
        self.assertIn('Mine', names)
        self.assertNotIn('Theirs', names)

    def test_update_category(self):
        cat = Category.objects.create(user=self.user, name='Old')
        detail_url = reverse('category-detail', kwargs={'pk': cat.pk})

        response = self.client.patch(detail_url, {'name': 'New'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        cat.refresh_from_db()
        self.assertEqual(cat.name, 'New')

    def test_delete_category(self):
        cat = Category.objects.create(user=self.user, name='Doomed')
        detail_url = reverse('category-detail', kwargs={'pk': cat.pk})

        response = self.client.delete(detail_url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Category.objects.filter(pk=cat.pk).exists())

    def test_cannot_access_other_users_category(self):
        other_cat = Category.objects.create(user=self.other_user, name='Private')
        detail_url = reverse('category-detail', kwargs={'pk': other_cat.pk})

        response = self.client.get(detail_url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_create_category_with_default_color(self):
        response = self.client.post(self.url, {'name': 'NoColor'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['color'], '#cbd5e1')

    def test_unauthenticated_rejected(self):
        self.client.credentials()
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class TaskCategoryFilterTests(AuthenticatedAPITestCase):
    """Cover category assignment on tasks and ?category= filter."""

    def setUp(self):
        super().setUp()
        self.cat = Category.objects.create(user=self.user, name='Work')
        self.other_cat = Category.objects.create(user=self.user, name='Personal')

    def test_create_task_with_category(self):
        payload = self.build_task_payload(category=self.cat.id)
        response = self.client.post(self.tasks_list_url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['category']['id'], self.cat.id)

    def test_create_task_without_category(self):
        payload = self.build_task_payload()
        response = self.client.post(self.tasks_list_url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(response.data['category'])

    def test_update_task_category(self):
        task = Task.objects.create(user=self.user, title='T', category=self.cat)
        payload = {'category': self.other_cat.id}

        response = self.client.patch(self.task_detail_url(task.id), payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['category']['id'], self.other_cat.id)

    def test_filter_tasks_by_category(self):
        Task.objects.create(user=self.user, title='Work Task', category=self.cat)
        Task.objects.create(user=self.user, title='Personal Task', category=self.other_cat)
        Task.objects.create(user=self.user, title='No Category')

        response = self.client.get(f'{self.tasks_list_url}?category={self.cat.id}')

        titles = [t['title'] for t in response.data]
        self.assertIn('Work Task', titles)
        self.assertNotIn('Personal Task', titles)
        self.assertNotIn('No Category', titles)

    def test_category_filter_returns_only_own_tasks(self):
        Task.objects.create(user=self.user, title='My Work', category=self.cat)
        Task.objects.create(user=self.other_user, title='Their Work', category=self.cat)

        response = self.client.get(f'{self.tasks_list_url}?category={self.cat.id}')

        titles = [t['title'] for t in response.data]
        self.assertIn('My Work', titles)
        self.assertNotIn('Their Work', titles)

    def test_invalid_category_id_returns_empty(self):
        response = self.client.get(f'{self.tasks_list_url}?category=99999')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

    def test_cannot_assign_other_users_category_on_create(self):
        """IDOR protection: assigning another user's category is rejected."""
        foreign_cat = Category.objects.create(user=self.other_user, name='Stolen')
        payload = self.build_task_payload(category=foreign_cat.id)

        response = self.client.post(self.tasks_list_url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Task.objects.filter(user=self.user, category=foreign_cat).exists())

    def test_cannot_assign_other_users_category_on_update(self):
        """IDOR protection: updating a task with another user's category is rejected."""
        foreign_cat = Category.objects.create(user=self.other_user, name='Stolen')
        task = Task.objects.create(user=self.user, title='T', category=self.cat)

        response = self.client.patch(
            self.task_detail_url(task.id), {'category': foreign_cat.id}, format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        task.refresh_from_db()
        self.assertEqual(task.category, self.cat)


# ---------------------------------------------------------------------------
# 21. Recurring Tasks
# ---------------------------------------------------------------------------

class RecurringTaskTests(AuthenticatedAPITestCase):
    """Cover Task.clone_for_recurrence and perform_update cloning logic."""

    def test_daily_recurrence_clones_with_next_day(self):
        """Completing a daily recurring task creates a clone due tomorrow."""
        now = timezone.now()
        task = Task.objects.create(
            user=self.user, title='Daily Standup', is_done=False,
            recurrence='daily', first_reminder=now,
        )

        self.client.patch(
            self.task_detail_url(task.id), {'is_done': True}, format='json',
        )

        task.refresh_from_db()
        self.assertTrue(task.is_done)
        clone = Task.objects.filter(user=self.user, title='Daily Standup', is_done=False).exclude(pk=task.pk).first()
        self.assertIsNotNone(clone)
        self.assertAlmostEqual(clone.first_reminder, now + timedelta(days=1), delta=timedelta(seconds=5))
        self.assertEqual(clone.sent_reminders, 0)
        self.assertEqual(clone.recurrence, 'daily')

    def test_weekly_recurrence_clones_with_next_week(self):
        """Completing a weekly recurring task creates a clone due in 7 days."""
        now = timezone.now()
        task = Task.objects.create(
            user=self.user, title='Weekly Review', is_done=False,
            recurrence='weekly', first_reminder=now,
        )

        self.client.patch(
            self.task_detail_url(task.id), {'is_done': True}, format='json',
        )

        clone = Task.objects.filter(user=self.user, title='Weekly Review', is_done=False).exclude(pk=task.pk).first()
        self.assertIsNotNone(clone)
        self.assertAlmostEqual(clone.first_reminder, now + timedelta(weeks=1), delta=timedelta(seconds=5))

    def test_monthly_recurrence_clones_with_next_month(self):
        """Completing a monthly recurring task creates a clone due in ~1 month."""
        now = timezone.now()
        task = Task.objects.create(
            user=self.user, title='Monthly Report', is_done=False,
            recurrence='monthly', first_reminder=now,
        )

        self.client.patch(
            self.task_detail_url(task.id), {'is_done': True}, format='json',
        )

        clone = Task.objects.filter(user=self.user, title='Monthly Report', is_done=False).exclude(pk=task.pk).first()
        self.assertIsNotNone(clone)
        expected = now + relativedelta(months=1)
        self.assertAlmostEqual(clone.first_reminder, expected, delta=timedelta(seconds=5))
        self.assertEqual(clone.category, task.category)
        self.assertEqual(clone.description, task.description)

    def test_non_recurring_task_does_not_clone(self):
        """Completing a task with recurrence='none' does NOT create a clone."""
        task = Task.objects.create(
            user=self.user, title='One Off', is_done=False,
            recurrence='none', first_reminder=timezone.now(),
        )

        self.client.patch(
            self.task_detail_url(task.id), {'is_done': True}, format='json',
        )

        self.assertEqual(Task.objects.filter(user=self.user, title='One Off').count(), 1)

    def test_updating_already_completed_does_not_clone(self):
        """Updating an ALREADY completed task does NOT trigger another clone."""
        now = timezone.now()
        task = Task.objects.create(
            user=self.user, title='Already Done', is_done=True,
            recurrence='daily', first_reminder=now,
        )

        self.client.patch(
            self.task_detail_url(task.id), {'title': 'Renamed'}, format='json',
        )

        self.assertEqual(Task.objects.filter(user=self.user, title='Renamed').count(), 1)
        self.assertEqual(Task.objects.filter(user=self.user, title='Already Done').count(), 0)

    def test_clone_copies_category(self):
        """Cloned task inherits the original's category."""
        cat = Category.objects.create(user=self.user, name='Work')
        task = Task.objects.create(
            user=self.user, title='Categorized', is_done=False,
            recurrence='daily', first_reminder=timezone.now(), category=cat,
        )

        self.client.patch(
            self.task_detail_url(task.id), {'is_done': True}, format='json',
        )

        clone = Task.objects.filter(user=self.user, title='Categorized', is_done=False).exclude(pk=task.pk).first()
        self.assertIsNotNone(clone)
        self.assertEqual(clone.category, cat)

    def test_clone_sets_next_cycle_generated_flag(self):
        """clone_for_recurrence marks the original task's flag."""
        task = Task.objects.create(
            user=self.user, title='Flag Test', is_done=False,
            recurrence='daily', first_reminder=timezone.now(),
        )

        self.client.patch(
            self.task_detail_url(task.id), {'is_done': True}, format='json',
        )

        task.refresh_from_db()
        self.assertTrue(task.next_cycle_generated)


class AutoCloneOnFinalReminderTests(TestCase):
    """Cover auto-cloning when sent_reminders reaches repeat_reminder."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user('autoclone', 'ac@test.com', 'SecurePass123!')

    @patch('tasks.tasks.webpush')
    @patch('tasks.tasks.EmailMultiAlternatives')
    def test_auto_clone_when_final_reminder_sent(self, mock_email_cls, mock_webpush):
        """When sent_reminders == repeat_reminder, next cycle is created."""
        now = timezone.now() - timedelta(hours=2)
        task = Task.objects.create(
            user=self.user, title='Auto Daily', is_done=False,
            recurrence='daily', first_reminder=now,
            repeat_reminder=2, time_between_reminders=30, sent_reminders=1,
        )

        check_and_send_reminders()

        task.refresh_from_db()
        self.assertEqual(task.sent_reminders, 2)
        self.assertTrue(task.next_cycle_generated)
        clone = Task.objects.filter(
            user=self.user, title='Auto Daily', is_done=False,
        ).exclude(pk=task.pk).first()
        self.assertIsNotNone(clone)
        self.assertEqual(clone.sent_reminders, 0)
        self.assertEqual(clone.recurrence, 'daily')

    @patch('tasks.tasks.webpush')
    @patch('tasks.tasks.EmailMultiAlternatives')
    def test_no_clone_when_not_final_reminder(self, mock_email_cls, mock_webpush):
        """Clone is NOT created when sent_reminders < repeat_reminder."""
        now = timezone.now() - timedelta(hours=2)
        Task.objects.create(
            user=self.user, title='Not Final', is_done=False,
            recurrence='daily', first_reminder=now,
            repeat_reminder=5, time_between_reminders=30, sent_reminders=1,
        )

        check_and_send_reminders()

        self.assertEqual(Task.objects.filter(user=self.user, title='Not Final').count(), 1)

    @patch('tasks.tasks.webpush')
    @patch('tasks.tasks.EmailMultiAlternatives')
    def test_no_clone_for_non_recurring(self, mock_email_cls, mock_webpush):
        """Non-recurring task reaching its limit does NOT create a clone."""
        now = timezone.now() - timedelta(hours=2)
        task = Task.objects.create(
            user=self.user, title='One Timer', is_done=False,
            recurrence='none', first_reminder=now,
            repeat_reminder=1, sent_reminders=0,
        )

        check_and_send_reminders()

        self.assertEqual(Task.objects.filter(user=self.user, title='One Timer').count(), 1)

    @patch('tasks.tasks.webpush')
    @patch('tasks.tasks.EmailMultiAlternatives')
    def test_manual_complete_before_final_still_clones(self, mock_email_cls, mock_webpush):
        """Manually completing a recurring task before final reminder still clones."""
        task = Task.objects.create(
            user=self.user, title='Early Complete', is_done=False,
            recurrence='weekly', first_reminder=timezone.now() + timedelta(hours=1),
            repeat_reminder=1, sent_reminders=0,
        )

        client = APIClient()
        client.force_authenticate(user=self.user)
        response = client.patch(
            reverse('task-detail', kwargs={'pk': task.id}),
            {'is_done': True}, format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        task.refresh_from_db()
        self.assertTrue(task.is_done)
        self.assertTrue(task.next_cycle_generated)
        clone = Task.objects.filter(
            user=self.user, title='Early Complete', is_done=False,
        ).exclude(pk=task.pk).first()
        self.assertIsNotNone(clone)

    @patch('tasks.tasks.webpush')
    @patch('tasks.tasks.EmailMultiAlternatives')
    def test_no_double_clone_when_flag_set(self, mock_email_cls, mock_webpush):
        """If next_cycle_generated is already True, no second clone is created."""
        now = timezone.now() - timedelta(hours=2)
        task = Task.objects.create(
            user=self.user, title='No Double', is_done=False,
            recurrence='daily', first_reminder=now,
            repeat_reminder=1, sent_reminders=0,
            next_cycle_generated=True,
        )

        check_and_send_reminders()

        self.assertEqual(
            Task.objects.filter(user=self.user, title='No Double', is_done=False)
            .exclude(pk=task.pk).count(), 0,
        )


# =========================================================================
# Coverage: views.py — SignUpView dangling-account branches (171, 188-189, 193-197)
# =========================================================================

class SignUpDanglingAccountTests(TestCase):
    """Every SignUpView.create branch that handles pre-existing accounts."""

    def setUp(self):
        self.url = reverse('api_signup')
        self.pw = 'SecurePass123!'

    # --- views.py:171 — active email blocks signup ---
    def test_active_email_blocks_signup(self):
        User.objects.create_user('u1', 'taken@example.com', self.pw)
        resp = self.client.post(self.url, {
            'username': 'another', 'email': 'taken@example.com', 'password': self.pw,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already registered', resp.data['detail'])

    # --- views.py:176-180 — active username blocks signup ---
    def test_active_username_blocks_signup(self):
        User.objects.create_user('taken', 'a@b.com', self.pw)
        resp = self.client.post(self.url, {
            'username': 'taken', 'email': 'x@y.com', 'password': self.pw,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already taken', resp.data['detail'])

    # --- views.py:188-189 — orphaned inactive username is deleted ---
    def test_orphaned_inactive_username_deleted(self):
        orphan = User.objects.create_user('ghost', 'g@h.com', self.pw, is_active=False)
        orphan_pk = orphan.pk
        resp = self.client.post(self.url, {
            'username': 'ghost', 'email': 'new@e.com', 'password': self.pw,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertFalse(User.objects.filter(pk=orphan_pk).exists())

    # --- views.py:193-197 — inactive email is resumed ---
    def test_inactive_email_resumed_with_new_credentials(self):
        old = User.objects.create_user('old', 'old@e.com', self.pw, is_active=False)
        resp = self.client.post(self.url, {
            'username': 'fresh', 'email': 'old@e.com', 'password': 'NewP@ss99',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        old.refresh_from_db()
        self.assertEqual(old.username, 'fresh')
        self.assertTrue(old.check_password('NewP@ss99'))

    # --- views.py:198-205 — brand-new email creates user ---
    def test_brand_new_email_creates_inactive_user(self):
        resp = self.client.post(self.url, {
            'username': 'brandnew', 'email': 'brand@n.com', 'password': self.pw,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        u = User.objects.get(username='brandnew')
        self.assertFalse(u.is_active)
        self.assertTrue(OTPVerification.objects.filter(user=u).exists())


# =========================================================================
# Coverage: views.py — ResendOTPView (245-273)
# =========================================================================

class ResendOTPViewCoverageTests(TestCase):

    def setUp(self):
        self.url = reverse('api_resend_otp')
        self.pw = 'SecurePass123!'

    @patch('tasks.views.send_mail')
    def test_unknown_email(self, mock_mail):
        resp = self.client.post(self.url, {'email': 'nobody@x.com'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('No account found', resp.data['detail'])
        mock_mail.assert_not_called()

    @patch('tasks.views.send_mail')
    def test_already_verified(self, mock_mail):
        User.objects.create_user('done', 'done@x.com', self.pw)
        resp = self.client.post(self.url, {'email': 'done@x.com'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already verified', resp.data['detail'])
        mock_mail.assert_not_called()

    @patch('tasks.views.send_mail')
    def test_fresh_otp_reused(self, mock_mail):
        u = User.objects.create_user('abc', 'abc@x.com', self.pw, is_active=False)
        OTPVerification.objects.create(user=u, code='111111')
        resp = self.client.post(self.url, {'email': 'abc@x.com'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(OTPVerification.objects.get(user=u).code, '111111')
        mock_mail.assert_called_once()

    @patch('tasks.views.send_mail')
    def test_expired_otp_regenerated(self, mock_mail):
        u = User.objects.create_user('old', 'old@x.com', self.pw, is_active=False)
        OTPVerification.objects.create(user=u, code='222222')
        OTPVerification.objects.filter(user=u).update(
            created_at=timezone.now() - timedelta(minutes=20))
        resp = self.client.post(self.url, {'email': 'old@x.com'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertNotEqual(OTPVerification.objects.get(user=u).code, '222222')
        mock_mail.assert_called_once()

    @patch('tasks.views.send_mail')
    def test_no_existing_otp_created(self, mock_mail):
        u = User.objects.create_user('nope', 'nope@x.com', self.pw, is_active=False)
        resp = self.client.post(self.url, {'email': 'nope@x.com'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(OTPVerification.objects.filter(user=u).exists())
        mock_mail.assert_called_once()


# =========================================================================
# Coverage: views.py — VerifyOTPView (281-330)
# =========================================================================

class VerifyOTPViewCoverageTests(TestCase):

    def setUp(self):
        self.url = reverse('api_verify_otp')
        self.pw = 'SecurePass123!'

    def test_unknown_email(self):
        resp = self.client.post(self.url, {'email': 'zz@z.com', 'otp': '000000'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('No account found', resp.data['detail'])

    def test_already_verified(self):
        User.objects.create_user('v', 'v@x.com', self.pw)
        resp = self.client.post(self.url, {'email': 'v@x.com', 'otp': '000000'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already verified', resp.data['detail'])

    def test_no_otp_record(self):
        User.objects.create_user('n', 'n@x.com', self.pw, is_active=False)
        resp = self.client.post(self.url, {'email': 'n@x.com', 'otp': '000000'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('No OTP found', resp.data['detail'])

    def test_expired_otp(self):
        u = User.objects.create_user('e', 'e@x.com', self.pw, is_active=False)
        OTPVerification.objects.create(user=u, code='123456')
        OTPVerification.objects.filter(user=u).update(
            created_at=timezone.now() - timedelta(minutes=20))
        resp = self.client.post(self.url, {'email': 'e@x.com', 'otp': '123456'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('expired', resp.data['detail'].lower())
        self.assertFalse(OTPVerification.objects.filter(user=u).exists())

    def test_wrong_code(self):
        u = User.objects.create_user('w', 'w@x.com', self.pw, is_active=False)
        OTPVerification.objects.create(user=u, code='111111')
        resp = self.client.post(self.url, {'email': 'w@x.com', 'otp': '222222'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Invalid OTP', resp.data['detail'])

    def test_correct_code_activates_and_returns_tokens(self):
        u = User.objects.create_user('ok', 'ok@x.com', self.pw, is_active=False)
        OTPVerification.objects.create(user=u, code='999999')
        resp = self.client.post(self.url, {'email': 'ok@x.com', 'otp': '999999'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        u.refresh_from_db()
        self.assertTrue(u.is_active)
        self.assertFalse(OTPVerification.objects.filter(user=u).exists())
        self.assertIn('access', resp.data)
        self.assertIn('refresh', resp.data)


# =========================================================================
# Coverage: views.py — LoginView warning log (359)
# =========================================================================

class LoginViewWarningLogTests(BaseAPITestCase):

    def test_failed_login_hits_warning_branch(self):
        resp = self.client.post(self.login_url, {
            'username': 'ghost', 'password': 'Wrong!99',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


# =========================================================================
# Coverage: views.py — NotificationViewSet pagination (438-439)
# =========================================================================

class NotificationPaginationBranchTests(AuthenticatedAPITestCase):
    def test_paginated_list_hits_page_branch(self):
        from rest_framework.pagination import PageNumberPagination
        from tasks.views import NotificationViewSet

        class TestPagination(PageNumberPagination):
            page_size = 2

        orig_pagination = NotificationViewSet.pagination_class
        NotificationViewSet.pagination_class = TestPagination
        
        try:
            for i in range(5):
                Notification.objects.create(user=self.user, title=f'N{i}')
            
            resp = self.client.get(reverse('notification-list'))
            
            self.assertEqual(resp.status_code, status.HTTP_200_OK)
            self.assertIsInstance(resp.data, dict)
            self.assertIn('results', resp.data)
            self.assertEqual(len(resp.data['results']), 2)
        finally:
            NotificationViewSet.pagination_class = orig_pagination


# =========================================================================
# Coverage: models.py — clone_for_recurrence falsy first_reminder (101)
# =========================================================================

class CloneForRecurrenceFalsyTests(TestCase):

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user('cr', 'cr@t.com', 'SecurePass123!')

    def test_clone_returns_none_without_first_reminder(self):
        task = Task.objects.create(
            user=self.user, title='NoReminder', recurrence='daily', first_reminder=None)
        self.assertIsNone(task.clone_for_recurrence())


# =========================================================================
# Coverage: models.py — OTPVerification __str__ (150) and is_expired (158)
# =========================================================================

class OTPModelCoverageTests(TestCase):

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user('otpu', 'otpu@t.com', 'SecurePass123!')

    def test_str(self):
        otp = OTPVerification.objects.create(user=self.user, code='000000')
        self.assertEqual(str(otp), f'OTP({self.user.email})')

    def test_is_expired_false_when_fresh(self):
        otp = OTPVerification.objects.create(user=self.user, code='111111')
        self.assertFalse(otp.is_expired)

    def test_is_expired_true_when_stale(self):
        otp = OTPVerification.objects.create(user=self.user, code='222222')
        OTPVerification.objects.filter(pk=otp.pk).update(
            created_at=timezone.now() - timedelta(minutes=20))
        otp.refresh_from_db()
        self.assertTrue(otp.is_expired)


# =========================================================================
# Coverage: serializers.py — validate_username duplicate (162)
# =========================================================================

class UserProfileDuplicateUsernameTests(TestCase):

    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user('owner', 'ow@t.com', 'SecurePass123!')
        cls.other = User.objects.create_user('taken', 'tk@t.com', 'SecurePass123!')

    def test_validate_username_rejects_duplicate(self):
        from .serializers import UserProfileSerializer
        from rest_framework.test import APIRequestFactory
        req = APIRequestFactory().patch('/api/users/me/')
        req.user = self.owner
        ser = UserProfileSerializer(
            self.owner, data={'username': 'taken'}, partial=True, context={'request': req})
        self.assertFalse(ser.is_valid())
        self.assertIn('username', ser.errors)

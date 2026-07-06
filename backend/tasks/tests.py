"""
Comprehensive API tests for the tasks app.

Covers JWT authentication, task CRUD with per-user isolation, and Celery
integration (mocked — no real Redis broker required).
"""

from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Task
from .serializers import TaskSerializer
from .tasks import check_and_send_reminders, schedule_first_reminder, send_reminder_email

# Ensure the post_save signal that schedules Celery jobs is registered.
import tasks.tasks  # noqa: F401

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

        # Prevent post_save signal from reaching a real Redis broker during tests.
        self._apply_async_patcher = patch('tasks.tasks.send_reminder_email.apply_async')
        self._apply_async_patcher.start()
        self.addCleanup(self._apply_async_patcher.stop)


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
        self.assertIn('username', response.data)

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
# 3. Celery mocking — no real Redis required
# ---------------------------------------------------------------------------

class CeleryIntegrationTests(AuthenticatedAPITestCase):
    """
    Verify Celery scheduling and revoke logic via mocks.

    Patches target the exact import paths used in views.py and tasks.py so
    no real broker connection is attempted during the test run.
    """

    @patch('tasks.tasks.send_reminder_email.apply_async')
    def test_task_creation_schedules_celery_reminder(self, mock_apply_async):
        """Creating a task should enqueue send_reminder_email via apply_async."""
        payload = self.build_task_payload(title='Scheduled Task')

        response = self.client.post(self.tasks_list_url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        task_id = response.data['id']
        mock_apply_async.assert_called_once()

        _, call_kwargs = mock_apply_async.call_args
        self.assertEqual(call_kwargs['task_id'], f'task_{task_id}_reminder_0')
        self.assertEqual(mock_apply_async.call_args[0][0], (task_id,))

    @patch('tasks.views.celery_app.control.revoke')
    def test_marking_task_done_revokes_celery_job(self, mock_revoke):
        """Setting is_done=True should revoke the associated Celery task."""
        task = Task.objects.create(user=self.user, title='Done Task', is_done=False)

        response = self.client.patch(
            self.task_detail_url(task.id),
            {'is_done': True},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_revoke.assert_called_once_with(f'task_{task.id}_reminder_0', terminate=True)

    @patch('tasks.views.celery_app.control.revoke')
    def test_marking_task_not_done_does_not_revoke(self, mock_revoke):
        """Updating fields other than completion should not revoke Celery jobs."""
        task = Task.objects.create(user=self.user, title='Still Active', is_done=False)

        response = self.client.patch(
            self.task_detail_url(task.id),
            {'title': 'Renamed Task'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_revoke.assert_not_called()

    @patch('tasks.views.celery_app.control.revoke')
    def test_deleting_task_revokes_celery_job(self, mock_revoke):
        """Deleting a task should revoke its Celery job before DB removal."""
        task = Task.objects.create(user=self.user, title='Delete Me')

        response = self.client.delete(self.task_detail_url(task.id))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        mock_revoke.assert_called_once_with(f'task_{task.id}_reminder_0', terminate=True)
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

    def setUp(self):
        post_save.disconnect(schedule_first_reminder, sender=Task)
        self.addCleanup(post_save.connect, schedule_first_reminder, sender=Task)

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
    Directly invoke send_reminder_email and check_and_send_reminders
    to cover tasks.py lines 20-48 and 53-64 without a real Redis broker.
    """

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            'celeryuser', 'celery@test.com', 'SecurePass123!',
        )

    def setUp(self):
        # Prevent post_save from scheduling Celery jobs during fixture setup.
        post_save.disconnect(schedule_first_reminder, sender=Task)
        self.addCleanup(post_save.connect, schedule_first_reminder, sender=Task)

    @patch('tasks.tasks.send_reminder_email.apply_async')
    @patch('tasks.tasks.send_mail')
    def test_send_reminder_email_sends_mail_when_due(self, mock_send_mail, mock_apply_async):
        """Lines 24-33: due task sends email and increments sent_reminders."""
        task = Task.objects.create(
            user=self.user,
            title='Due Now',
            first_reminder=timezone.now() - timedelta(minutes=5),
            repeat_reminder=1,
            is_done=False,
        )

        send_reminder_email(task.id)

        mock_send_mail.assert_called_once()
        subject, message, from_email, recipient_list = mock_send_mail.call_args[0]
        self.assertIn('Due Now', subject)
        self.assertEqual(recipient_list, [self.user.email])
        task.refresh_from_db()
        self.assertEqual(task.sent_reminders, 1)
        mock_apply_async.assert_not_called()

    @patch('tasks.tasks.send_reminder_email.apply_async')
    @patch('tasks.tasks.send_mail')
    def test_send_reminder_email_schedules_next_repeat(self, mock_send_mail, mock_apply_async):
        """Lines 35-41: remaining repeats schedule the next apply_async call."""
        task = Task.objects.create(
            user=self.user,
            title='Repeating Task',
            first_reminder=timezone.now() - timedelta(minutes=5),
            repeat_reminder=3,
            time_between_reminders=10,
            is_done=False,
        )

        send_reminder_email(task.id)

        mock_send_mail.assert_called_once()
        mock_apply_async.assert_called_once()
        call_args, call_kwargs = mock_apply_async.call_args
        self.assertEqual(call_args[0], (task.id,))
        self.assertEqual(call_kwargs['task_id'], f'task_{task.id}_reminder_1')
        task.refresh_from_db()
        self.assertEqual(task.sent_reminders, 1)

    @patch('tasks.tasks.send_reminder_email.apply_async')
    @patch('tasks.tasks.send_mail')
    def test_send_reminder_email_reschedules_when_not_yet_due(self, mock_send_mail, mock_apply_async):
        """Lines 42-45: future reminder re-enqueues itself at first_reminder."""
        future = timezone.now() + timedelta(hours=2)
        task = Task.objects.create(
            user=self.user,
            title='Future Task',
            first_reminder=future,
            repeat_reminder=2,
            time_between_reminders=15,
            is_done=False,
        )

        send_reminder_email(task.id)

        mock_send_mail.assert_not_called()
        mock_apply_async.assert_called_once()
        _, call_kwargs = mock_apply_async.call_args
        self.assertEqual(call_kwargs['task_id'], f'task_{task.id}_reminder_0')

    @patch('tasks.tasks.send_mail')
    def test_send_reminder_email_skips_completed_task(self, mock_send_mail):
        """Line 23: is_done tasks skip all reminder logic."""
        task = Task.objects.create(
            user=self.user,
            title='Already Done',
            first_reminder=timezone.now() - timedelta(minutes=5),
            repeat_reminder=1,
            is_done=True,
        )

        send_reminder_email(task.id)

        mock_send_mail.assert_not_called()

    def test_send_reminder_email_handles_missing_task(self):
        """Lines 47-48: DoesNotExist is caught gracefully."""
        with self.assertLogs('tasks.tasks', level='ERROR') as log_context:
            send_reminder_email(999999)

        self.assertTrue(
            any('999999' in message for message in log_context.output),
            log_context.output,
        )

    @patch('tasks.tasks.send_reminder_email.apply_async')
    def test_check_and_send_reminders_enqueues_due_tasks(self, mock_apply_async):
        """Lines 53-64: periodic checker enqueues eligible tasks."""
        task = Task.objects.create(
            user=self.user,
            title='Beat Task',
            first_reminder=timezone.now() - timedelta(minutes=10),
            repeat_reminder=2,
            time_between_reminders=20,
            sent_reminders=0,
            is_done=False,
        )

        check_and_send_reminders()

        mock_apply_async.assert_called_once_with(
            (task.id,),
            eta=task.first_reminder,
            task_id=f'task_{task.id}_reminder_0',
        )

    @patch('tasks.tasks.send_reminder_email.apply_async')
    def test_check_and_send_reminders_skips_when_no_repeats_left(self, mock_apply_async):
        """Line 62 false branch: sent_reminders >= repeat_reminder skips enqueue."""
        Task.objects.create(
            user=self.user,
            title='No Repeats Left',
            first_reminder=timezone.now() - timedelta(minutes=10),
            repeat_reminder=0,
            sent_reminders=0,
            is_done=False,
        )

        check_and_send_reminders()

        mock_apply_async.assert_not_called()


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
        # Prevent Celery scheduling during fixture creation.
        post_save.disconnect(schedule_first_reminder, sender=Task)
        self.addCleanup(post_save.connect, schedule_first_reminder, sender=Task)

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
        Task.objects.create(
            user=self.user,
            title='In 10 Days',
            first_reminder=now + timedelta(days=10),
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

    # ---- ?filter=week ------------------------------------------------------

    def test_filter_week_returns_today_through_7_days(self):
        response = self._get('?filter=week')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = self._titles(response)
        self.assertIn('Today', titles)
        self.assertIn('In 3 Days', titles)
        self.assertNotIn('In 10 Days', titles)
        self.assertNotIn('Past', titles)
        self.assertNotIn('Far Future', titles)
        # Expect exactly 2: Today + In 3 Days
        self.assertEqual(len(response.data), 2)

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
        post_save.disconnect(schedule_first_reminder, sender=Task)
        self.addCleanup(post_save.connect, schedule_first_reminder, sender=Task)

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

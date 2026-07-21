<div align="center">

# ⏰ Reminder App

**A production-grade task reminder and notification platform built with Django REST Framework.**

[![Python 3.10+](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat&logo=python&logoColor=white)](https://www.python.org/)
[![Django 5.2](https://img.shields.io/badge/Django-5.2-092E20?style=flat&logo=django&logoColor=white)](https://www.djangoproject.com/)
[![DRF 3.16](https://img.shields.io/badge/DRF-3.16-A30D52?style=flat)](https://www.django-rest-framework.org/)
[![Docker](https://img.shields.io/badge/Docker_Compose-2496ED?style=flat&logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![Coverage 100%](https://img.shields.io/badge/Coverage-100%25-brightgreen?style=flat)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## 📖 Overview

Reminder App is a full-stack web application that lets users create tasks with smart reminder scheduling. It dispatches notifications through **Web Push**, **Telegram**, **Email**, and **real-time WebSockets** — powered by Celery background workers and Django Channels.

The entire stack is containerized with Docker Compose: an ASGI server (Daphne) for WebSocket support, a Celery worker + beat scheduler, MySQL database, Redis broker, and a React frontend served via Nginx.

---

## ✨ Key Features

### 🔐 Authentication & Security
- **JWT Authentication** — Access/refresh token flow via SimpleJWT with token blacklisting on logout
- **Email OTP Verification** — 6-digit cryptographically-secure OTP (`secrets` module) with a 15-minute expiry window
- **HTML Email Templates** — Responsive, RTL-compatible Persian HTML emails rendered via Django templates with plain-text fallback
- **Dangling Account Resolution** — Automatically reclaims abandoned unverified accounts (both email and username) during re-signup, keeping the database clean
- **Security Headers** — HSTS, XSS filtering, content-type nosniff, secure cookies, `X-Frame-Options: DENY`

### 📋 Task Management
- **Full CRUD** — Create, read, update, and delete tasks with strict per-user data isolation
- **Recurring Tasks** — Daily, weekly, and monthly recurrence with automatic next-cycle generation via `clone_for_recurrence`
- **Multi-Reminder Scheduling** — Configurable repeat count and interval between individual reminder dispatches
- **Categories** — Color-coded task grouping with per-user uniqueness constraints
- **Smart Filtering** — Query by time window (`today`, `week`, `month`), completion status, category, and recurrence

### 🔔 Multi-Channel Notifications
- **Web Push (VAPID)** — Browser push notifications via the Web Push API with `pywebpush`
- **Telegram Bot** — Account linking via UUID tokens and inline reminder delivery through `pyTelegramBotAPI`
- **Email** — SMTP-based emails with responsive HTML templates (Gmail integration)
- **WebSocket** — Real-time push via Django Channels 4.2 + Redis pub/sub, served by Daphne (ASGI)
- **Notification Center** — Read/unread tracking, mark-read, mark-all-read with indexed queries

### ⚙️ Background Processing
- **Celery Worker** — Executes reminder dispatch, email sending, and push notifications asynchronously
- **Celery Beat** — Periodic task scheduler (`django-celery-beat`) checking for due reminders every 60 seconds
- **Channel Layers** — Redis-backed pub/sub for WebSocket group messaging per user

### 🧪 Testing
- **100% Code Coverage** — Comprehensive unit, integration, and API tests across all modules
- **Coverage targets**: `models.py`, `views.py`, `serializers.py`, `tasks.py`, and the complete authentication/OTP flow

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Language** | Python 3.10+ |
| **Framework** | Django 5.2, Django REST Framework 3.16 |
| **Auth** | SimpleJWT (access/refresh tokens, blacklisting) |
| **Task Queue** | Celery 5.5 + Redis 7 (broker & result backend) |
| **Scheduler** | Celery Beat (`django-celery-beat`) |
| **WebSockets** | Django Channels 4.2 + Daphne (ASGI) |
| **Database** | MySQL 8.0 |
| **Cache / Broker** | Redis 7 (Alpine) |
| **Push Notifications** | `pywebpush` (VAPID), `pyTelegramBotAPI` |
| **Email** | Django SMTP backend (Gmail TLS) |
| **Frontend** | React 19, Tailwind CSS 4, Vite 8, i18next |
| **Proxy** | Nginx (frontend), Xray (Telegram network tunnel) |
| **Containerization** | Docker Compose (8 services) |
| **Testing** | Django TestCase, DRF APIClient, `unittest.mock`, `coverage.py` |

---

## ⚙️ Prerequisites

You need exactly **one** dependency on your host machine:

- [Docker](https://docs.docker.com/get-docker/) with Docker Compose V2+

*Python, Node.js, and MySQL are NOT required on your host.*

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/ArtADnsh/reminder-app.git
cd reminder-app
```

### 2. Configure environment variables

Create **`backend/.env`** with the following:

```env
# Django
SECRET_KEY=your-super-secret-django-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# MySQL
DB_NAME=reminder_db
DB_USER=root
DB_PASSWORD=YourSecurePassword123
DB_HOST=db
DB_PORT=3306

# Gmail SMTP (use an App Password, not your real password)
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-specific-password

# Telegram Bot
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_BOT_USERNAME=your_bot_username

# Web Push (VAPID keys — generate with: py-vapid gen)
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_PUBLIC_KEY=your-vapid-public-key

# Redis / Celery
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0
CHANNEL_REDIS_URL=redis://redis:6379/0
```

### 3. Build and launch the stack

```bash
docker compose up --build -d
```

Database migrations and static file collection run automatically on backend startup.

### 4. Access the application

| URL | Description |
|-----|-------------|
| `http://localhost` | Frontend (React + Nginx) |
| `http://localhost:8000/api/` | REST API root |
| `http://localhost:8000/admin/` | Django admin panel |

---

## 🐳 Service Architecture

The stack runs **8 containers** on an isolated Docker bridge network:

| Service | Container | Role | Exposed Port |
|---------|-----------|------|:------------:|
| **backend** | `reminder_backend` | Django API + Daphne (ASGI) | 8000 |
| **frontend** | `reminder_frontend` | React SPA via Nginx | 80 |
| **db** | `reminder_db` | MySQL 8.0 (persistent volume) | — |
| **redis** | `reminder_redis` | Redis 7 — broker + cache + channels | — |
| **celery_worker** | `reminder_celery_worker` | Async task execution | — |
| **celery_beat** | `reminder_celery_beat` | Periodic scheduler (60s interval) | — |
| **telegram_bot** | `reminder_bot` | Telegram bot process | — |
| **xray-proxy** | `xray-proxy` | Network tunnel for Telegram API | 10809 |

Internal services (MySQL, Redis) expose **no ports** to the host — they're accessible only via Docker DNS. Every container uses `healthchecks` and `restart: always` for self-healing.

---

## 🧪 Running Tests

```bash
# Run the full test suite with coverage
docker compose exec backend coverage run manage.py test tasks -v2

# Print the coverage report to terminal
docker compose exec backend coverage report -m
```

To generate an HTML coverage report:

```bash
docker compose exec backend coverage html
# Then open htmlcov/index.html in your browser
```

---

## 📡 API Reference

All endpoints are prefixed with `/api/`. Authentication endpoints are public; all others require a valid JWT `Bearer` token in the `Authorization` header.

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `POST` | `/auth/signup/` | — | Register a new account. Creates an inactive user, generates a 6-digit OTP, and sends a verification email. |
| `POST` | `/auth/verify-otp/` | — | Verify email with OTP. Activates the account and returns JWT access + refresh tokens. |
| `POST` | `/auth/resend-otp/` | — | Resend the OTP email. Reuses an unexpired code; generates a new one if expired. |
| `POST` | `/auth/login/` | — | Login with username + password. Returns JWT tokens + user metadata. |
| `POST` | `/auth/token/refresh/` | — | Exchange a refresh token for a new access token. |
| `POST` | `/auth/logout/` | 🔒 | Blacklist the refresh token and invalidate the session. |

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/tasks/` | List user's tasks. Supports `?filter=today\|week\|month`, `?status=pending\|completed`, `?category=<id>`, `?is_recurring=true`, `?mine=1` (staff). |
| `POST` | `/tasks/` | Create a new task with optional recurrence and reminder scheduling. |
| `GET` | `/tasks/{id}/` | Retrieve a single task (owner or staff only). |
| `PATCH` | `/tasks/{id}/` | Partial update (e.g., toggle `is_done` — triggers recurrence cloning). |
| `PUT` | `/tasks/{id}/` | Full update of all task fields. |
| `DELETE` | `/tasks/{id}/` | Delete a task. |

### Categories

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/categories/` | List user's categories. |
| `POST` | `/categories/` | Create a category (unique name per user). |
| `PATCH` | `/categories/{id}/` | Update category name or color. |
| `DELETE` | `/categories/{id}/` | Delete a category (tasks become unassigned). |

### Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/notifications/` | List notifications. Supports `?unread=true`. |
| `PATCH` | `/notifications/{id}/mark-read/` | Mark a single notification as read. |
| `POST` | `/notifications/mark-all-read/` | Mark all unread notifications as read. |
| `DELETE` | `/notifications/{id}/` | Delete a notification. |

### User Profile

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/users/me/` | Get current user's profile. |
| `PATCH` | `/users/me/` | Partial profile update (username). |
| `POST` | `/users/me/change-password/` | Change password (requires old password). |

### Integrations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/webpush/subscribe/` | Register a Web Push subscription (VAPID). |
| `GET` | `/telegram/link/` | Get a Telegram linking URL with UUID token. |
| `DELETE` | `/telegram/link/` | Disconnect the Telegram account. |

---

## 🔒 Security Notes

- **Never commit `.env` files** to version control. They are listed in `.gitignore`.
- In production, replace `localhost` entries in `CORS_ALLOWED_ORIGINS` (`settings.py`) with your actual domain.
- MySQL and Redis ports are intentionally **not mapped** to the host. Only the backend (8000) and frontend (80) are exposed.
- JWT access tokens expire after **60 minutes**; refresh tokens after **1 day** with blacklisting on rotation.
- OTP codes are generated using Python's `secrets` module (cryptographically secure) and expire after **15 minutes**.

---

## 📂 Project Structure

```
reminder-app/
├── backend/
│   ├── TODOList/              # Django project settings, ASGI/WSGI, Celery config
│   ├── tasks/                 # Core application
│   │   ├── models.py          # Task, Category, Notification, OTPVerification, ...
│   │   ├── views.py           # API views (signup, OTP, CRUD, profile, integrations)
│   │   ├── serializers.py     # DRF serializers with business logic validation
│   │   ├── tasks.py           # Celery tasks (reminder dispatch, periodic checker)
│   │   ├── consumers.py       # WebSocket consumer for real-time notifications
│   │   ├── telegram_utils.py  # Telegram bot notification helper
│   │   ├── tests.py           # Full test suite (100% coverage)
│   │   ├── urls.py            # API routing
│   │   └── migrations/        # Database migrations
│   ├── templates/
│   │   └── otp_email.html     # RTL Persian HTML email template
│   ├── manage.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                  # React + Vite + Tailwind CSS SPA
│   ├── src/
│   ├── nginx.conf
│   └── Dockerfile
├── proxy/                     # Xray network proxy for Telegram API
├── docker-compose.yml
└── README.md
```

---

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

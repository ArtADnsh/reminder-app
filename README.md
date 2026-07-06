# Reminder App - Full-Stack Production Architecture

A production-ready, fully containerized Full-Stack application designed to schedule, manage, and dispatch intelligent reminders. 

This project demonstrates a decoupled, highly scalable architecture utilizing a robust asynchronous task queue, an isolated relational database, and a modernized frontend—all orchestrated via Docker.

---

## 🏗 System Architecture Overview

The application is distributed across several specialized microservices communicating within a secure, isolated Docker bridge network. 

- **Frontend (React + Vite + Tailwind v4):** A snappy, responsive Single Page Application (SPA) served via **Nginx**. Nginx also acts as a reverse proxy, routing `/api/` and `/admin/` requests securely to the backend.
- **Backend (Django 5 + Django REST Framework):** The core API handling business logic, JWT-based authentication, and CRUD operations for tasks. Served via **Gunicorn** with multiple worker processes.
- **Task Queue (Celery + Redis):** Handles asynchronous, non-blocking operations. **Redis** acts as the high-throughput message broker, while **Celery Workers** dispatch the actual reminder emails.
- **Scheduler (Celery Beat):** Acts as a periodic cron-like scheduler, ensuring that missed or recurring reminders are reliably queued into Redis.
- **Database (MySQL 8.0):** The persistent, relational data store, optimized with composite indices and connection pooling.

### Technical Pillars
- **Portability:** The entire application runs identically on any machine with Docker installed. Zero "it works on my machine" issues.
- **Isolation:** Internal services (MySQL, Redis, Celery) are heavily locked down. They expose **no ports** to the host system and are only accessible by the backend via internal Docker DNS.
- **Self-Healing:** All containers utilize explicit Docker `healthchecks` and `restart: always` policies. If a process crashes or a dependency is unavailable, Docker will automatically wait and restart the service until stability is restored.

---

## ⚙️ Prerequisites

To run this project, you need exactly **one** dependency installed on your system:
- [Docker](https://docs.docker.com/get-docker/) (with Docker Compose V2)

*Python, Node.js, and MySQL are NOT required on your host machine.*

---

## 🚀 Quick Start (Setup Instructions)

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd reminder-app
   ```

2. **Configure Environment Variables:**
   The project requires two `.env` files to securely manage secrets.
   
   Create `.env` in the root directory:
   ```env
   DB_NAME=todo_db
   DB_USER=reminder_app
   DB_PASSWORD=YourSecurePassword123
   ```

   Create `backend/.env` in the backend directory:
   ```env
   SECRET_KEY=your_secure_random_django_secret_key
   DB_NAME=todo_db
   DB_USER=root
   DB_PASSWORD=YourSecurePassword123
   DB_HOST=db
   DB_PORT=3306
   EMAIL_HOST_USER=your_email@gmail.com
   EMAIL_HOST_PASSWORD=your_app_specific_password
   DEBUG=False
   ALLOWED_HOSTS=localhost,127.0.0.1
   CELERY_BROKER_URL=redis://redis:6379/0
   CELERY_RESULT_BACKEND=redis://redis:6379/0
   ```

3. **Build and Launch the Stack:**
   ```bash
   docker compose up -d --build
   ```

4. **Access the Application:**
   - Frontend UI: `http://localhost`
   - API Endpoints: `http://localhost/api/`
   - Django Admin: `http://localhost/admin/`

*(Note: Database migrations and static file collection are executed automatically during the backend container startup).*

---

## 🐳 Service Breakdown

| Service | Container Name | Role & Details |
|---------|---------------|----------------|
| **`frontend`** | `reminder_frontend` | Builds the React SPA and serves it via Nginx on port 80. Proxies API requests to the backend. |
| **`backend`** | `reminder_backend` | Runs the Django API via Gunicorn. Waits for DB/Redis to be healthy before starting. |
| **`celery_worker`** | `reminder_celery_worker` | Consumes tasks from Redis and executes them (e.g., sending emails). |
| **`celery_beat`** | `reminder_celery_beat` | Periodic scheduler that enqueues tasks based on predefined intervals. |
| **`db`** | `reminder_db` | MySQL 8.0 database. Data is persisted to the host via a Docker named volume. |
| **`redis`** | `reminder_redis` | In-memory datastore acting as the Celery broker. Persists data via a named volume. |

---

## 🛠 Development & Maintenance

### Inspecting Logs
To view the logs of the entire stack in real-time:
```bash
docker compose logs -f
```
To view logs for a specific service (e.g., to debug an email task):
```bash
docker compose logs -f celery_worker
```

### Manual Migrations & Management Commands
Migrations are handled automatically on startup, but you can run Django management commands interactively if needed:
```bash
docker compose exec backend python manage.py createsuperuser
docker compose exec backend python manage.py makemigrations
docker compose exec backend python manage.py test
```

### Stopping and Cleaning Up
To gracefully stop all services:
```bash
docker compose stop
```

To tear down the network and remove containers:
```bash
docker compose down
```

**⚠️ Warning (Data Destruction):** If you wish to completely wipe the database and Redis cache, append the `-v` flag to destroy the named volumes:
```bash
docker compose down -v
```

---

## 🔒 Security Notes
- **Never commit `.env` files** to version control.
- In a live production environment, replace `http://localhost` in `CORS_ALLOWED_ORIGINS` (inside `settings.py`) with your actual production domain.
- The default configuration isolates MySQL and Redis. Do not map their ports (`3306`, `6379`) to the host machine unless absolutely necessary for external debugging.

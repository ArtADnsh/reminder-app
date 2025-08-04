# Reminder App

A simple, extensible Django-based reminder application with REST API support and background task scheduling using Celery.

## Features

- User authentication with JWT tokens (using Django REST Framework)
- Create, update, and delete reminders
- **Automated email notifications:** Reminders are sent to users via email
- Asynchronous email delivery using Celery with Redis as the message broker
- Scheduled tasks and periodic reminders with Celery & django-celery-beat
- API-first design for easy frontend integration
- Easy local development setup with pipenv or requirements.txt

## Tech Stack

- Python 3.x
- Django 5.x
- Django REST Framework
- Celery (with Redis as broker)
- django-celery-beat for scheduled tasks

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/ArtADnsh/reminder-app.git
cd reminder-app
```
### 2. install requirements

```
pip install requirements.txt
```
### 3. install redis and use python 3.12

currently there's no redis verion for newer pythons
[reddis for windows(unofficial)](https://github.com/redis-windows/redis-windows), 
[reddis for linux](https://redis.io/docs/latest/operate/oss_and_stack/install/archive/install-redis/install-redis-on-linux/)
### 4. don't forget to make your own .ven file

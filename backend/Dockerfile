FROM python:3.10-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set work directory
WORKDIR /app

# Install system dependencies needed for compiling mysqlclient and other dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    default-libmysqlclient-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Copy only requirements.txt first to leverage Docker layer caching
COPY requirements.txt /app/

# Install python dependencies (including gunicorn for production)
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir gunicorn daphne

# Copy the rest of the application code
COPY . /app/

# Expose the API port
EXPOSE 8000

# Start Django with Gunicorn
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "TODOList.asgi:application"]

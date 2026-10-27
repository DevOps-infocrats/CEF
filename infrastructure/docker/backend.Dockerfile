FROM python:3.11-slim

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies required for building wheels and connecting to PostgreSQL
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    libreoffice \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend workspace code
COPY backend/ /app/

EXPOSE 8000

# Run migrations and start the server (Using WSGI/Gunicorn is ideal for production, 
# but using manage.py here to match your current setup)
CMD ["python", "manage.py", "runserver", "8000"]


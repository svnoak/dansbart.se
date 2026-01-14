# Dockerfile
FROM python:3.10-slim

# 1. Install System Dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libsndfile1 \
    ffmpeg \
    g++ \
    gcc \
    git \
    nodejs \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# 2. Set work directory
WORKDIR /app

# 3. Environment Config (CPU-only)
ENV CUDA_VISIBLE_DEVICES="-1"
ENV TF_CPP_MIN_LOG_LEVEL="2"

# 4. Upgrade pip
RUN pip install --no-cache-dir --upgrade pip

# 5. Install numpy and Cython first (common build deps)
RUN pip install --no-cache-dir numpy Cython

# 6. Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 7. Copy the rest of the application (includes alembic/)
COPY . .

# 8. Copy and set up entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Use the entrypoint
ENTRYPOINT ["/docker-entrypoint.sh"]

# Default command (can be overridden)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
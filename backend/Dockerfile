# Use Python 3.10 - It is the "Goldilocks" version:
# New enough for FastApi, old enough for stable audio libraries (Essentia/Madmom)
FROM --platform=linux/amd64 python:3.10-slim

# 1. Install System Dependencies
# - build-essential: for compiling madmom/cython
# - libsndfile1: required by librosa
# - ffmpeg: required by yt-dlp and some audio processing
# - git: to fetch madmom from source
RUN apt-get update && apt-get install -y \
    build-essential \
    libsndfile1 \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*

# 2. Set work directory
WORKDIR /app

# 3. Install Dependencies
# We install numpy and Cython *first* because madmom needs them present during its build
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir numpy Cython

# 4. Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 5. Copy the rest of the application
COPY . .

# Default command (keeps container running or runs web server)
# We'll override this with 'manage.py' commands often
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
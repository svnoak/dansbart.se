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
    && rm -rf /var/lib/apt/lists/*

# 2. Set work directory
WORKDIR /app

# 3. Environment Config for CPU-Only MLOps
# This stops TensorFlow/Madmom from trying to find a GPU and printing those errors
ENV CUDA_VISIBLE_DEVICES="-1"
ENV TF_CPP_MIN_LOG_LEVEL="2" 
# (Level 2 silences INFO and WARNING, keeping only ERRORs)

# 4. Install Dependencies
RUN pip install --no-cache-dir --upgrade pip
# Install numpy/cython first for build dependencies
RUN pip install --no-cache-dir numpy Cython

# 5. Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# OPTIONAL: If madmom is not in your requirements.txt or fails, 
# uncomment the line below to install the latest directly from source:
# RUN pip install --no-cache-dir git+https://github.com/CPJKU/madmom.git

# 6. Copy the rest of the application
COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    git \
    nano \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libopenblas-dev \
    v4l-utils \
    curl \
    ca-certificates \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ARG REPO_URL
# update certificates or it will break after some time
#RUN apt-get update && apt-get install -y ca-certificates git && update-ca-certificates
RUN git clone $REPO_URL .

RUN pip install --no-cache-dir \
    "numpy<2" \
    tflite-runtime \
    opencv-python-headless \
    requests

EXPOSE 8000

#CMD ["python", "app.py"]
CMD ["python", "/tmp/app2.py"]

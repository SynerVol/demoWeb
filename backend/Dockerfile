FROM python:3.11-slim
WORKDIR /app


RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc python3-dev libxml2-dev && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# Core deps — must succeed
RUN pip install --no-cache-dir fastapi==0.111.0 "uvicorn[standard]==0.29.0"
# Hardware deps — allowed to fail (not available on x86 build machines)
RUN pip install --no-cache-dir dronekit==2.9.2 pymavlink==2.4.41 || \
    echo "⚠ dronekit install failed — hardware features disabled"
#RUN pip install --no-cache-dir -r requirements.txt


#COPY main.py .
COPY . . 

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

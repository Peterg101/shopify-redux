# Force x86_64 — cadquery-ocp has no arm64 wheels on PyPI
FROM --platform=linux/amd64 python:3.11-slim

WORKDIR /app

# Install system deps for CadQuery (OCP) + X11 rendering libs required at import time
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libxrender1 libxmu6 libxi6 libxext6 libx11-6 libxft2 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# CadQuery is large (~500MB) — install separately for better Docker layer caching
RUN pip install --no-cache-dir cadquery

COPY . .

EXPOSE 1235

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "1235"]

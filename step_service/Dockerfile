FROM python:3.11-slim

WORKDIR /app

# Install system deps for CadQuery (OCP) and trimesh
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# CadQuery is large (~500MB) — install separately for better Docker layer caching
RUN pip install --no-cache-dir cadquery==2.4.0 || echo "CadQuery install failed — will run in metadata-only mode"

COPY . .

EXPOSE 1235

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "1235"]

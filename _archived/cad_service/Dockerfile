FROM python:3.11-slim

WORKDIR /app

# System deps for CadQuery (OCP)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install shared packages (fitd_schemas + jwt_auth)
COPY fitd_schemas/ /packages/fitd_schemas/
COPY jwt_auth/ /packages/jwt_auth/
RUN pip install --no-cache-dir /packages/fitd_schemas/ /packages/jwt_auth/

# Install service dependencies
COPY cad_service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY cad_service/ .

EXPOSE 1236

CMD ["python", "main.py"]

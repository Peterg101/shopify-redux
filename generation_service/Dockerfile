FROM python:3.11-slim

WORKDIR /app

# Install service dependencies
COPY generation_service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install shared packages (fitd_schemas + jwt_auth)
COPY fitd_schemas/ /packages/fitd_schemas/
COPY jwt_auth/ /packages/jwt_auth/
RUN pip install --no-cache-dir /packages/fitd_schemas/ /packages/jwt_auth/

COPY generation_service/ .

EXPOSE 1234

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "1234"]

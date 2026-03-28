import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import onboard, webhooks, payouts, checkout, shipping
import uvicorn
import stripe

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

app = FastAPI()

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Register routes
app.include_router(onboard.router)
app.include_router(webhooks.router)
app.include_router(payouts.router)
app.include_router(checkout.router)
app.include_router(shipping.router)

@app.get("/health")
async def health_check():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run(app, host=os.getenv("HOST", "127.0.0.1"), port=100)
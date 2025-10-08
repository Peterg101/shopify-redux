from fastapi import FastAPI
from stripe_client import StripeClient
from fastapi.middleware.cors import CORSMiddleware
from routes import onboard
import uvicorn

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(onboard.router)

# You can initialize the Shopify client once if needed
stripe_client = ShopifyClient()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=369)
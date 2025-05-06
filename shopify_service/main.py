from fastapi import FastAPI
from shopify_client import ShopifyClient
from fastapi.middleware.cors import CORSMiddleware
from routes import checkout, webhook
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
app.include_router(checkout.router)
app.include_router(webhook.router)

# You can initialize the Shopify client once if needed
shopify = ShopifyClient()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=369)
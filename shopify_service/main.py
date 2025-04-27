from fastapi import FastAPI
from shopify_client import ShopifyClient
from routes import checkout, webhook
import uvicorn

app = FastAPI()

# Register routes
app.include_router(checkout.router)
app.include_router(webhook.router)

# You can initialize the Shopify client once if needed
shopify = ShopifyClient()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=369)
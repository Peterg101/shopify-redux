from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import onboard, webhooks
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
app.include_router(webhooks.router)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=100)
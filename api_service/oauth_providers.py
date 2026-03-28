"""OAuth provider implementations — Google + GitHub."""
import os
import logging
import asyncio
from dataclasses import dataclass
from typing import Optional
import httpx
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

logger = logging.getLogger(__name__)


@dataclass
class OAuthUserInfo:
    provider: str
    provider_user_id: str
    email: str
    name: Optional[str]
    email_verified: bool


# Google OAuth
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback")

# GitHub OAuth
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")
GITHUB_REDIRECT_URI = os.getenv("GITHUB_REDIRECT_URI", "http://localhost:8000/auth/github/callback")


def get_google_authorize_url(state: str = "") -> str:
    return (
        f"https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={GOOGLE_CLIENT_ID}"
        f"&redirect_uri={GOOGLE_REDIRECT_URI}"
        f"&response_type=code"
        f"&scope=openid%20email%20profile"
        f"&access_type=offline"
        f"&state={state}"
    )


async def google_exchange_code(code: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post("https://oauth2.googleapis.com/token", data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        })
        resp.raise_for_status()
        return resp.json()


async def google_get_user_info(token_data: dict) -> OAuthUserInfo:
    id_info = await asyncio.to_thread(
        google_id_token.verify_oauth2_token,
        token_data["id_token"],
        google_requests.Request(),
        GOOGLE_CLIENT_ID,
    )
    return OAuthUserInfo(
        provider="google",
        provider_user_id=id_info["sub"],
        email=id_info["email"],
        name=id_info.get("name"),
        email_verified=id_info.get("email_verified", False),
    )


def get_github_authorize_url(state: str = "") -> str:
    return (
        f"https://github.com/login/oauth/authorize"
        f"?client_id={GITHUB_CLIENT_ID}"
        f"&redirect_uri={GITHUB_REDIRECT_URI}"
        f"&scope=read:user%20user:email"
        f"&state={state}"
    )


async def github_exchange_code(code: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": GITHUB_REDIRECT_URI,
            },
            headers={"Accept": "application/json"},
        )
        resp.raise_for_status()
        return resp.json()


async def github_get_user_info(token_data: dict) -> OAuthUserInfo:
    headers = {
        "Authorization": f"Bearer {token_data['access_token']}",
        "Accept": "application/json",
    }
    async with httpx.AsyncClient() as client:
        user_resp = await client.get("https://api.github.com/user", headers=headers)
        user_data = user_resp.json()

        email = user_data.get("email")
        email_verified = False

        if not email:
            # GitHub may hide email — fetch from /user/emails
            emails_resp = await client.get("https://api.github.com/user/emails", headers=headers)
            emails = emails_resp.json()
            for e in emails:
                if e.get("primary") and e.get("verified"):
                    email = e["email"]
                    email_verified = True
                    break
            if not email and emails:
                email = emails[0]["email"]
        else:
            email_verified = True

    return OAuthUserInfo(
        provider="github",
        provider_user_id=str(user_data["id"]),
        email=email,
        name=user_data.get("name") or user_data.get("login"),
        email_verified=email_verified,
    )

"""Email verification and password reset via Resend."""
import os
import logging
import jwt
import datetime

logger = logging.getLogger(__name__)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
EMAIL_SECRET = os.getenv("EMAIL_VERIFICATION_SECRET", os.getenv("JWT_SECRET_KEY"))
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
EMAIL_FROM = os.getenv("EMAIL_FROM", "FITD <noreply@fitd.dev>")


def generate_verification_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "purpose": "email_verification",
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=24),
        "iat": datetime.datetime.utcnow(),
    }
    return jwt.encode(payload, EMAIL_SECRET, algorithm="HS256")


def verify_verification_token(token: str) -> dict:
    payload = jwt.decode(token, EMAIL_SECRET, algorithms=["HS256"])
    if payload.get("purpose") != "email_verification":
        raise jwt.InvalidTokenError("Wrong token purpose")
    return payload


def generate_reset_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "purpose": "password_reset",
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=1),
        "iat": datetime.datetime.utcnow(),
    }
    return jwt.encode(payload, EMAIL_SECRET, algorithm="HS256")


def verify_reset_token(token: str) -> dict:
    payload = jwt.decode(token, EMAIL_SECRET, algorithms=["HS256"])
    if payload.get("purpose") != "password_reset":
        raise jwt.InvalidTokenError("Wrong token purpose")
    return payload


async def send_verification_email(to_email: str, token: str):
    if not RESEND_API_KEY:
        logger.warning(f"RESEND_API_KEY not set — verification email for {to_email} not sent")
        return

    import resend
    resend.api_key = RESEND_API_KEY

    verification_url = f"{FRONTEND_URL}/verify-email?token={token}"
    resend.Emails.send({
        "from": EMAIL_FROM,
        "to": [to_email],
        "subject": "Verify your FITD account",
        "html": f"""
            <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
                <h2 style="color: #00E5FF;">Welcome to FITD</h2>
                <p>Click the button below to verify your email address:</p>
                <a href="{verification_url}"
                   style="background: #00E5FF; color: #0A0E14; padding: 12px 24px;
                          text-decoration: none; border-radius: 6px; display: inline-block;
                          font-weight: 600; margin: 16px 0;">
                    Verify Email
                </a>
                <p style="color: #666; font-size: 14px;">This link expires in 24 hours.</p>
                <p style="color: #666; font-size: 14px;">If you didn't create an account, ignore this email.</p>
            </div>
        """,
    })


async def send_reset_email(to_email: str, token: str):
    if not RESEND_API_KEY:
        logger.warning(f"RESEND_API_KEY not set — reset email for {to_email} not sent")
        return

    import resend
    resend.api_key = RESEND_API_KEY

    reset_url = f"{FRONTEND_URL}/reset-password?token={token}"
    resend.Emails.send({
        "from": EMAIL_FROM,
        "to": [to_email],
        "subject": "Reset your FITD password",
        "html": f"""
            <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
                <h2 style="color: #00E5FF;">Password Reset</h2>
                <p>Click the button below to reset your password:</p>
                <a href="{reset_url}"
                   style="background: #00E5FF; color: #0A0E14; padding: 12px 24px;
                          text-decoration: none; border-radius: 6px; display: inline-block;
                          font-weight: 600; margin: 16px 0;">
                    Reset Password
                </a>
                <p style="color: #666; font-size: 14px;">This link expires in 1 hour.</p>
                <p style="color: #666; font-size: 14px;">If you didn't request a reset, ignore this email.</p>
            </div>
        """,
    })

import os
import logging
import httpx
from typing import Optional, List
from fitd_schemas.fitd_classes import UserInformation
from service_client import ServiceClient

logger = logging.getLogger(__name__)

AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://localhost:2468")


# ── Auth Service Calls (cookie-based, no JWT) ────────────────────────

async def session_exists(session_id: str) -> bool:
    cookies = {"fitd_session_data": session_id}
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{AUTH_SERVICE_URL}/session", cookies=cookies)
            return response.status_code == 200
        except httpx.HTTPError as e:
            logger.error(f"HTTP error checking session: {e}")
            return False


async def session_exists_user_only(session_id: str) -> Optional[UserInformation]:
    cookies = {"fitd_session_data": session_id}
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{AUTH_SERVICE_URL}/get_just_user_details", cookies=cookies)
            if response.status_code == 200:
                return UserInformation.parse_obj(response.json())
            logger.error(f"Failed to fetch user details: {response.status_code}")
            return None
        except httpx.HTTPError as e:
            logger.error(f"HTTP error fetching user details: {e}")
            return None


# ── DB Service Calls (injected client) ───────────────────────────────

async def check_user_stripe_onboarded(db_api: ServiceClient, user_id: str) -> Optional[dict]:
    try:
        response = await db_api.get(f"/user_onboarded_with_stripe/{user_id}")
        if response.status_code == 204:
            return None
        if response.status_code == 200:
            return response.json()
        logger.error(f"Unexpected status checking Stripe onboarding: {response.status_code}")
        return None
    except httpx.HTTPError as e:
        logger.error(f"HTTP error checking Stripe onboarding: {e}")
        return None


async def get_all_basket_items(db_api: ServiceClient, user_id: str) -> List[dict]:
    try:
        response = await db_api.get("/all_basket_items", params={"user_id": user_id})
        if response.status_code == 200:
            return response.json()
        logger.error(f"Error fetching basket items: {response.status_code}")
        return []
    except httpx.HTTPError as e:
        logger.error(f"HTTP error fetching basket items: {e}")
        return []


async def create_orders_from_checkout(db_api: ServiceClient, checkout_payload: dict) -> dict:
    try:
        response = await db_api.post("/orders/create_from_stripe_checkout", json=checkout_payload)
        if response.status_code in (200, 201):
            return response.json()
        logger.error(f"Failed to create orders: {response.status_code} - {response.text}")
        return {"status": "error", "detail": response.text}
    except httpx.HTTPError as e:
        logger.error(f"HTTP error creating orders: {e}")
        return {"status": "error", "detail": str(e)}


async def get_fulfiller_address(db_api: ServiceClient, user_id: str) -> Optional[dict]:
    try:
        response = await db_api.get(f"/users/{user_id}/fulfiller_address")
        if response.status_code == 200:
            return response.json()
        logger.error(f"Fulfiller address not found: {response.status_code}")
        return None
    except httpx.HTTPError as e:
        logger.error(f"HTTP error fetching fulfiller address: {e}")
        return None


async def get_claim_detail(db_api: ServiceClient, claim_id: str) -> Optional[dict]:
    try:
        response = await db_api.get(f"/claims/{claim_id}/shipping_context")
        if response.status_code == 200:
            return response.json()
        logger.error(f"Claim detail not found: {response.status_code}")
        return None
    except httpx.HTTPError as e:
        logger.error(f"HTTP error fetching claim detail: {e}")
        return None


async def update_claim_shipping(db_api: ServiceClient, claim_id: str, shipping_data: dict) -> Optional[dict]:
    try:
        response = await db_api.patch(f"/claims/{claim_id}/shipping", json=shipping_data)
        if response.status_code == 200:
            return response.json()
        logger.error(f"Failed to update claim shipping: {response.status_code}")
        return None
    except httpx.HTTPError as e:
        logger.error(f"HTTP error updating claim shipping: {e}")
        return None


async def confirm_onboarding(db_api: ServiceClient, stripe_account_id: str) -> Optional[dict]:
    try:
        response = await db_api.post(f"/stripe/confirm_onboarding/{stripe_account_id}")
        if response.status_code == 200:
            return response.json()
        logger.error(f"Failed to confirm onboarding: {response.status_code}")
        return None
    except httpx.HTTPError as e:
        logger.error(f"HTTP error confirming onboarding: {e}")
        return None


async def update_orders_by_payment_intent(db_api: ServiceClient, payment_intent_id: str, status: str) -> Optional[dict]:
    try:
        response = await db_api.patch(
            f"/orders/by_payment_intent/{payment_intent_id}/status",
            json={"status": status},
        )
        if response.status_code == 200:
            return response.json()
        logger.error(f"Failed to update orders for {payment_intent_id}: {response.status_code}")
        return None
    except httpx.HTTPError as e:
        logger.error(f"HTTP error updating orders: {e}")
        return None


async def freeze_disbursements_by_payment_intent(db_api: ServiceClient, payment_intent_id: str) -> Optional[dict]:
    try:
        response = await db_api.patch(f"/disbursements/by_payment_intent/{payment_intent_id}/freeze")
        if response.status_code == 200:
            return response.json()
        logger.error(f"Failed to freeze disbursements for {payment_intent_id}: {response.status_code}")
        return None
    except httpx.HTTPError as e:
        logger.error(f"HTTP error freezing disbursements: {e}")
        return None


async def generate_stripe_account_in_db(db_api: ServiceClient, user_id: str, stripe_account_id: str) -> Optional[dict]:
    try:
        response = await db_api.post(
            f"/generate_user_stripe_account_in_db/{user_id}",
            json={"stripe_account_id": stripe_account_id},
        )
        if response.status_code in (200, 201):
            return response.json()
        logger.error(f"Failed to create Stripe account record: {response.status_code}")
        return None
    except httpx.HTTPError as e:
        logger.error(f"HTTP error creating Stripe account: {e}")
        return None


async def get_pending_disbursement(db_api: ServiceClient, claim_id: str) -> Optional[dict]:
    try:
        response = await db_api.get(f"/disbursements/pending/{claim_id}")
        if response.status_code == 200:
            return response.json()
        logger.error(f"No pending disbursement for claim {claim_id}: {response.status_code}")
        return None
    except httpx.HTTPError as e:
        logger.error(f"HTTP error fetching disbursement: {e}")
        return None


async def mark_disbursement_paid(db_api: ServiceClient, disbursement_id: str, stripe_transfer_id: str,
                                  source_transaction: Optional[str] = None,
                                  transfer_group: Optional[str] = None) -> Optional[dict]:
    try:
        response = await db_api.patch(
            f"/disbursements/{disbursement_id}/paid",
            json={
                "stripe_transfer_id": stripe_transfer_id,
                "source_transaction": source_transaction,
                "transfer_group": transfer_group,
            },
        )
        if response.status_code == 200:
            return response.json()
        logger.error(f"Failed to mark disbursement paid: {response.status_code}")
        return None
    except httpx.HTTPError as e:
        logger.error(f"HTTP error marking disbursement paid: {e}")
        return None

from io import BytesIO
import httpx
import requests
from jwt_auth import generate_token
from models import (MeshyPayload, MeshyRefinedPayload,
                    MeshyTaskGeneratedResponse, MeshyTaskStatus,
                    MeshyTaskStatusResponse, TaskInformation)

MESHY_API_KEY = "msy_RLiG6FNDJRdsNfSKCoFJ5E2Jhcs4r1l5Hmjp"


def generate_text_to_3d_task(payload: MeshyPayload) -> MeshyTaskGeneratedResponse:
    headers = {"Authorization": f"Bearer {MESHY_API_KEY}"}
    print(payload)
    try:
        response = requests.post(
            "https://api.meshy.ai/v2/text-to-3d", headers=headers, json=payload.__dict__
        )
        response.raise_for_status()
        result = MeshyTaskGeneratedResponse(**response.json())
        return result

    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")
        return None


def get_meshy_task_status(meshy_task_args: MeshyTaskStatus) -> MeshyTaskStatusResponse:
    headers = {"Authorization": f"Bearer {MESHY_API_KEY}"}
    response = requests.get(
        f"https://api.meshy.ai/v2/text-to-3d/{meshy_task_args.task_id}",
        headers=headers,
    )
    response.raise_for_status()
    print(response.json())

    result = MeshyTaskStatusResponse(**response.json())
    return result


def generate_meshy_refine_task(
    payload: MeshyRefinedPayload,
) -> MeshyTaskGeneratedResponse:
    headers = {"Authorization": f"Bearer {MESHY_API_KEY}"}

    response = requests.post(
        "https://api.meshy.ai/v2/text-to-3d",
        headers=headers,
        json=payload.__dict__,
    )
    response.raise_for_status()
    print(response.json())

    result = MeshyTaskGeneratedResponse(**response.json())
    return result


def get_obj_file_blob(url: str) -> BytesIO:
    response = requests.get(url)
    response.raise_for_status()
    blob = BytesIO(response.content)
    return blob


async def session_exists(session_id: str):
    url = "http://localhost:2468/get_session"
    headers = {
        "Cookie": f"{session_id}"
    }
    print('running')
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)
    return response.status_code == 200


async def create_task(task_information: TaskInformation):
    auth_token = generate_token()
    url = "http://localhost:8000/tasks"  # Adjust with your actual FastAPI URL
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}",  # Add the auth token here
    }

    # Send the POST request with user data and session token in cookies
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=task_information.dict(), headers=headers)

        if response.status_code == 200:
            # If successful, return the user data
            return response.json()
        else:
            # Handle any errors
            print(f"Error: {response.status_code} - {response.text}")
            return None
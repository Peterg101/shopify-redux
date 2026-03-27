"""
SSE event publishing via Redis Pub/Sub.

Events are published to user-specific channels (sse:{user_id}) or
the global channel (sse:global) for marketplace-wide updates.

The SSE endpoint subscribes to both channels and streams events to
the connected frontend client.
"""

import json
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


def publish_event(redis_client, event_type: str, user_id: str = None, data: dict = None) -> None:
    """
    Publish an SSE event via Redis Pub/Sub.

    Args:
        redis_client: Redis connection (or None to skip)
        event_type: Event name (e.g. "basket:updated", "order:created")
        user_id: Target user (None for global broadcast)
        data: Optional extra data to include in the event payload
    """
    if redis_client is None:
        return

    channel = f"sse:{user_id}" if user_id else "sse:global"
    payload = {
        "event": event_type,
        "timestamp": datetime.utcnow().isoformat(),
    }
    if data:
        payload["data"] = data

    try:
        redis_client.publish(channel, json.dumps(payload))
        logger.debug(f"Published {event_type} to {channel}")
    except Exception:
        logger.warning(f"Failed to publish {event_type} to {channel}")

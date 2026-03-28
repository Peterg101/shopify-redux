"""
Multi-tier cache-aside layer for db_service.

L1: In-memory TTLCache (per-process, for static reference data only)
L2: Redis (shared across all workers/pods)

Falls through to DB on Redis failure — never crashes on cache errors.

Usage:
    from cache import cached, cache_invalidate

    @app.get("/manufacturing/processes")
    def get_processes(db=Depends(get_db), redis=Depends(get_redis)):
        return cached(
            redis, "fitd:ref:processes", ttl=21600,
            loader=lambda: [ProcessResponse.from_orm(p) for p in db.query(Process).all()],
            model_class=ProcessResponse, is_list=True, l1=True, l1_ttl=3600,
        )
"""

import json
import logging
from typing import Callable, Optional, Type, TypeVar, Union, List

from cachetools import TTLCache
from pydantic import BaseModel

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

# L1 cache — per-process, for reference/static data only
_l1_cache: TTLCache = TTLCache(maxsize=256, ttl=3600)


def cached(
    redis_client,
    key: str,
    ttl: int,
    loader: Callable,
    model_class: Type[T],
    is_list: bool = False,
    l1: bool = False,
    l1_ttl: int = 3600,
) -> Union[T, List[T]]:
    """
    Cache-aside: L1 (optional) → L2 (Redis) → loader (DB).

    Args:
        redis_client: Redis connection (or None to skip L2)
        key: Cache key (e.g. "fitd:ref:processes")
        ttl: L2 (Redis) TTL in seconds
        loader: Callable that returns data on cache miss (Pydantic model or list)
        model_class: Pydantic model class for deserialization
        is_list: Whether the cached value is a list of models
        l1: Enable in-memory L1 cache (use only for static/reference data)
        l1_ttl: L1 TTL in seconds (ignored if l1=False)
    """
    # --- L1 check ---
    if l1 and key in _l1_cache:
        return _l1_cache[key]

    # --- L2 check ---
    if redis_client is not None:
        try:
            raw = redis_client.get(key)
            if raw is not None:
                if is_list:
                    result = [model_class.parse_obj(item) for item in json.loads(raw)]
                else:
                    result = model_class.parse_raw(raw)
                if l1:
                    _l1_cache[key] = result
                return result
        except Exception:
            logger.warning(f"Redis GET failed for {key}, falling through to DB")

    # --- Cache miss: load from DB ---
    result = loader()

    # --- Populate L2 ---
    if redis_client is not None:
        try:
            if is_list:
                serialized = json.dumps([item.dict() for item in result])
            else:
                serialized = result.json()
            redis_client.set(key, serialized, ex=ttl)
        except Exception:
            logger.warning(f"Redis SET failed for {key}")

    # --- Populate L1 ---
    if l1:
        _l1_cache[key] = result

    return result


def cache_invalidate(redis_client, *keys: str, clear_l1: bool = False) -> None:
    """Delete one or more cache keys from L2 (and optionally L1)."""
    if redis_client is not None and keys:
        try:
            redis_client.delete(*keys)
        except Exception:
            logger.warning(f"Redis DELETE failed for {keys}")

    if clear_l1:
        for key in keys:
            _l1_cache.pop(key, None)


def cache_invalidate_pattern(redis_client, pattern: str) -> int:
    """Delete all Redis keys matching a glob pattern (e.g. 'fitd:claimable:*')."""
    count = 0
    if redis_client is not None:
        try:
            for key in redis_client.scan_iter(match=pattern, count=100):
                redis_client.delete(key)
                count += 1
        except Exception:
            logger.warning(f"Redis SCAN/DELETE failed for pattern {pattern}")
    return count

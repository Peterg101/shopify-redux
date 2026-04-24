"""Lightweight embedding computation using sentence-transformers."""
import json
import os
import logging

logger = logging.getLogger(__name__)

_model = None


def get_embedding_model():
    """Lazy-load the sentence-transformers model (singleton)."""
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
            model_name = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
            _model = SentenceTransformer(model_name)
            logger.info(f"Loaded embedding model: {model_name}")
        except ImportError:
            logger.warning("sentence-transformers not installed — embeddings disabled")
            return None
    return _model


def compute_embedding(text: str) -> str | None:
    """Compute embedding for text, return as JSON string of floats.

    Returns None if sentence-transformers is not installed or computation fails.
    """
    if not text or not text.strip():
        return None
    model = get_embedding_model()
    if model is None:
        return None
    try:
        vec = model.encode(text, normalize_embeddings=True)
        return json.dumps(vec.tolist())
    except Exception as e:
        logger.warning(f"Embedding computation failed: {e}")
        return None


def cosine_similarity(a_json: str, b_json: str) -> float:
    """Compute cosine similarity between two embedding JSON strings.

    Returns 0.0 on any error (mismatched dimensions, zero vectors, parse errors).
    """
    try:
        import numpy as np
        a = np.array(json.loads(a_json))
        b = np.array(json.loads(b_json))
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(np.dot(a, b) / (norm_a * norm_b))
    except Exception:
        return 0.0

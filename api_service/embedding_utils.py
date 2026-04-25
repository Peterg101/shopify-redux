"""Lightweight embedding computation using TF-IDF hashing.

No PyTorch, no GPU, no 500MB downloads. Uses scikit-learn's HashingVectorizer
for fixed-dimension embeddings that work well for BM25-style retrieval.

Upgrade path: when you deploy to a server with GPU, swap this for
sentence-transformers with all-MiniLM-L6-v2 for better semantic similarity.
"""
import json
import logging
import re
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

# Fixed dimension for all embeddings
EMBEDDING_DIM = 384

_vectorizer = None


def _get_vectorizer():
    """Lazy-init a simple hashing vectorizer."""
    global _vectorizer
    if _vectorizer is not None:
        return _vectorizer

    try:
        from sklearn.feature_extraction.text import HashingVectorizer
        _vectorizer = HashingVectorizer(
            n_features=EMBEDDING_DIM,
            alternate_sign=False,
            norm='l2',
            ngram_range=(1, 2),
        )
        logger.info("Loaded HashingVectorizer for embeddings")
        return _vectorizer
    except ImportError:
        logger.warning("scikit-learn not installed — embeddings disabled")
        return None


def _tokenize(text: str) -> str:
    """Simple tokenization: lowercase, split on non-alphanumeric, remove short tokens."""
    text = text.lower()
    tokens = re.split(r'[^a-z0-9]+', text)
    return ' '.join(t for t in tokens if len(t) > 1)


def compute_embedding(text: str) -> Optional[str]:
    """Compute embedding for text, return as JSON string of floats.

    Returns None if computation fails or text is empty.
    """
    if not text or not text.strip():
        return None

    vec = _get_vectorizer()
    if vec is None:
        return None

    try:
        tokenized = _tokenize(text)
        if not tokenized:
            return None
        embedding = vec.transform([tokenized]).toarray()[0]
        return json.dumps(embedding.tolist())
    except Exception as e:
        logger.warning(f"Embedding computation failed: {e}")
        return None


def cosine_similarity(a_json: str, b_json: str) -> float:
    """Compute cosine similarity between two embedding JSON strings.

    Returns 0.0 on any error.
    """
    try:
        a = np.array(json.loads(a_json))
        b = np.array(json.loads(b_json))
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(np.dot(a, b) / (norm_a * norm_b))
    except Exception:
        return 0.0

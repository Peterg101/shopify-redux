import sys
from unittest.mock import MagicMock

# aioredis is incompatible with Python 3.11+; mock it before any module imports it
sys.modules.setdefault("aioredis", MagicMock())

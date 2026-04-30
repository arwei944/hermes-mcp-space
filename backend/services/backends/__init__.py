# -*- coding: utf-8 -*-
"""Hermes Agent - 持久化后端包"""

from backend.services.backends.git_backend import GitBackend
from backend.services.backends.hf_buckets_backend import HFBucketsBackend

__all__ = ["GitBackend", "HFBucketsBackend"]

# 后端注册表
BACKEND_REGISTRY = {
    "git": GitBackend,
    "hf_buckets": HFBucketsBackend,
}

import pytest
import time


def test_version_api_performance(client):
    start = time.time()
    resp = client.get("/api/version")
    elapsed = (time.time() - start) * 1000
    assert resp.status_code == 200
    assert elapsed < 3000, f"Version API took {elapsed:.0f}ms"


def test_sessions_list_performance(client):
    start = time.time()
    resp = client.get("/api/sessions")
    elapsed = (time.time() - start) * 1000
    assert resp.status_code == 200
    assert elapsed < 5000, f"Sessions list took {elapsed:.0f}ms"


def test_search_performance(client):
    start = time.time()
    resp = client.get("/api/sessions/search?q=test")
    elapsed = (time.time() - start) * 1000
    assert resp.status_code == 200
    assert elapsed < 5000, f"Search took {elapsed:.0f}ms"

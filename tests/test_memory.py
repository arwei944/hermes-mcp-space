import pytest


def test_read_memory(client):
    resp = client.get("/api/memory")
    assert resp.status_code == 200


def test_update_memory(client):
    resp = client.put("/api/memory", json={"memory": "pytest memory test"})
    assert resp.status_code == 200
    data = resp.json()
    assert "memory" in data


def test_user_profile(client):
    resp = client.get("/api/user/profile")
    assert resp.status_code == 200

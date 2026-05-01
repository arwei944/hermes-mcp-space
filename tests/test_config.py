import pytest


def test_get_config(client):
    resp = client.get("/api/config")
    assert resp.status_code == 200


def test_get_versions(client):
    resp = client.get("/api/config/versions")
    assert resp.status_code == 200


def test_reset_config(client):
    resp = client.post("/api/config/reset")
    assert resp.status_code == 200

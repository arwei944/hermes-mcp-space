import pytest


def test_version_api(client):
    resp = client.get("/api/version")
    assert resp.status_code == 200
    data = resp.json()
    assert "version" in data
    assert data["version"] == "7.0.0"


def test_health_check(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"


def test_meta(client):
    resp = client.get("/api/meta")
    assert resp.status_code == 200


def test_homepage(client):
    resp = client.get("/")
    assert resp.status_code == 200
    assert "text/html" in resp.headers.get("content-type", "")


def test_openapi(client):
    resp = client.get("/openapi.json")
    assert resp.status_code == 200

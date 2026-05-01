import pytest


def test_persistence_status(client):
    resp = client.get("/api/persistence/status")
    assert resp.status_code == 200


def test_persistence_backends(client):
    resp = client.get("/api/persistence/backends")
    assert resp.status_code == 200


def test_manual_backup(client):
    resp = client.post("/api/persistence/backup", json={"items": ["sessions"]})
    assert resp.status_code == 200

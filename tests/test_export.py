import pytest


def test_export_json(client, test_session_with_messages):
    resp = client.get(f"/api/sessions/{test_session_with_messages}/export?format=json")
    assert resp.status_code == 200


def test_export_markdown(client, test_session_with_messages):
    resp = client.get(f"/api/sessions/{test_session_with_messages}/export?format=markdown")
    assert resp.status_code == 200


def test_export_all(client):
    resp = client.get("/api/sessions/export")
    assert resp.status_code == 200


def test_export_not_found(client):
    resp = client.get("/api/sessions/nonexistent/export?format=json")
    assert resp.status_code == 404

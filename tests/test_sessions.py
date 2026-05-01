import pytest


def test_create_session(client):
    resp = client.post("/api/sessions", json={"title": "test", "source": "e2e"})
    assert resp.status_code == 200
    sid = resp.json().get("id") or resp.json().get("session", {}).get("id")
    assert sid is not None
    client.delete(f"/api/sessions/{sid}")


def test_list_sessions(client):
    resp = client.get("/api/sessions")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


def test_get_session(client, test_session):
    resp = client.get(f"/api/sessions/{test_session}")
    assert resp.status_code == 200


def test_session_stats(client):
    resp = client.get("/api/sessions/stats")
    assert resp.status_code == 200


def test_add_message(client, test_session):
    resp = client.post(f"/api/sessions/{test_session}/messages", json={
        "role": "user", "content": "hello"
    })
    assert resp.status_code == 200


def test_get_messages(client, test_session_with_messages):
    resp = client.get(f"/api/sessions/{test_session_with_messages}/messages")
    assert resp.status_code == 200


def test_delete_session(client, test_session):
    resp = client.delete(f"/api/sessions/{test_session}")
    assert resp.status_code == 200


def test_session_not_found(client):
    resp = client.get("/api/sessions/nonexistent-id-12345")
    assert resp.status_code == 404

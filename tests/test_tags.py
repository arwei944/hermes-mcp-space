import pytest


def test_get_tags(client, test_session):
    resp = client.get(f"/api/sessions/{test_session}/tags")
    assert resp.status_code == 200


def test_set_tags_put(client, test_session):
    resp = client.put(f"/api/sessions/{test_session}/tags", json={"tags": ["test", "e2e"]})
    assert resp.status_code == 200


def test_set_tags_post(client, test_session):
    resp = client.post(f"/api/sessions/{test_session}/tags", json={"tags": ["post-test"]})
    assert resp.status_code == 200


def test_rename_tag(client):
    resp = client.put("/api/sessions/tags/rename", json={"old_name": "test", "new_name": "tested"})
    assert resp.status_code == 200

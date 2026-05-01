import pytest


def test_batch_delete(client):
    # 创建临时会话
    r1 = client.post("/api/sessions", json={"title": "batch-del-1", "source": "e2e"}).json()
    r2 = client.post("/api/sessions", json={"title": "batch-del-2", "source": "e2e"}).json()
    s1 = r1.get("id") or r1.get("session", {}).get("id")
    s2 = r2.get("id") or r2.get("session", {}).get("id")
    ids = [s1, s2] if isinstance(s1, str) and isinstance(s2, str) else []
    if ids:
        resp = client.post("/api/sessions/batch/delete", json={"session_ids": ids})
        assert resp.status_code == 200


def test_batch_archive(client, test_session):
    resp = client.post("/api/sessions/batch/archive", json={"session_ids": [test_session]})
    assert resp.status_code == 200

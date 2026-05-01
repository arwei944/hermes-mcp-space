import pytest


def test_list_cron_jobs(client):
    resp = client.get("/api/cron")
    assert resp.status_code == 200


def test_create_cron_job(client):
    resp = client.post("/api/cron", json={
        "name": "pytest-cron-test",
        "cron_expression": "0 0 31 2 *",
        "message": "pytest cron test - should not actually run",
        "enabled": False
    })
    assert resp.status_code == 200
    # 清理
    data = resp.json()
    job_id = data.get("id")
    if job_id:
        client.delete(f"/api/cron/{job_id}")


def test_cron_toggle(client):
    resp = client.post("/api/cron", json={
        "name": "pytest-cron-toggle",
        "cron_expression": "0 0 31 2 *",
        "message": "pytest cron toggle test",
        "enabled": False
    })
    assert resp.status_code == 200
    data = resp.json()
    job_id = data.get("id")
    if job_id:
        # 切换启用状态
        resp2 = client.put(f"/api/cron/{job_id}/toggle", json={"enabled": True})
        assert resp2.status_code == 200
        # 清理
        client.delete(f"/api/cron/{job_id}")

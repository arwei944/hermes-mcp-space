import pytest

SKILL_NAME = "pytest-skill-v7"


def test_create_skill(client):
    resp = client.post("/api/skills", json={
        "name": SKILL_NAME, "content": "# Test Skill\nThis is a test.", "description": "e2e"
    })
    assert resp.status_code == 200


def test_get_skill(client):
    resp = client.get(f"/api/skills/{SKILL_NAME}")
    assert resp.status_code == 200


def test_list_skills(client):
    resp = client.get("/api/skills")
    assert resp.status_code == 200


def test_update_skill(client):
    resp = client.put(f"/api/skills/{SKILL_NAME}", json={
        "content": "# Updated\nUpdated content."
    })
    assert resp.status_code == 200


def test_delete_skill(client):
    resp = client.delete(f"/api/skills/{SKILL_NAME}")
    assert resp.status_code == 200

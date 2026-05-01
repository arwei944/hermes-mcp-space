import pytest
import urllib.parse


def test_search_keyword(client, test_session_with_messages):
    resp = client.get("/api/sessions/search?q=代码")
    assert resp.status_code == 200


def test_search_empty(client):
    resp = client.get("/api/sessions/search?q=")
    assert resp.status_code == 200


def test_search_special_chars(client):
    q = urllib.parse.quote("<script>alert(1)</script>")
    resp = client.get(f"/api/sessions/search?q={q}")
    assert resp.status_code == 200
    assert "<script>" not in resp.text


def test_search_pagination(client):
    resp = client.get("/api/sessions/search?q=test&page=1&limit=5")
    assert resp.status_code == 200

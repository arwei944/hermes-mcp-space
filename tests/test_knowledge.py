import pytest


def test_summarize(client, test_session_with_messages):
    resp = client.get(f"/api/sessions/{test_session_with_messages}/knowledge/summary")
    assert resp.status_code == 200


def test_extract_urls(client, test_session_with_messages):
    resp = client.get(f"/api/sessions/{test_session_with_messages}/knowledge/urls")
    assert resp.status_code == 200


def test_extract_todos(client, test_session_with_messages):
    resp = client.get(f"/api/sessions/{test_session_with_messages}/knowledge/todos")
    assert resp.status_code == 200


def test_extract_code(client, test_session_with_messages):
    resp = client.get(f"/api/sessions/{test_session_with_messages}/knowledge/code")
    assert resp.status_code == 200


def test_extract_metrics(client, test_session_with_messages):
    resp = client.get(f"/api/sessions/{test_session_with_messages}/knowledge/metrics")
    assert resp.status_code == 200

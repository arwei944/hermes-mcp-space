import pytest


def test_overview(client):
    resp = client.get("/api/sessions/analytics/overview")
    assert resp.status_code == 200


def test_trend_daily(client):
    resp = client.get("/api/sessions/analytics/trend?period=daily")
    assert resp.status_code == 200


def test_trend_weekly(client):
    resp = client.get("/api/sessions/analytics/trend?period=weekly")
    assert resp.status_code == 200


def test_distribution(client):
    resp = client.get("/api/sessions/analytics/distribution")
    assert resp.status_code == 200


def test_hourly(client):
    resp = client.get("/api/sessions/analytics/hourly")
    assert resp.status_code == 200

import pytest


def test_list_plugins(client):
    resp = client.get("/api/plugins")
    assert resp.status_code == 200


def test_plugin_market(client):
    resp = client.get("/api/plugins/market")
    assert resp.status_code == 200


def test_plugin_tools(client):
    resp = client.get("/api/plugins/tools")
    assert resp.status_code == 200

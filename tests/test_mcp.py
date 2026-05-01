import pytest


def test_mcp_ping(client):
    resp = client.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "ping"})
    assert resp.status_code == 200
    data = resp.json()
    assert "jsonrpc" in data


def test_mcp_initialize(client):
    resp = client.post("/mcp", json={
        "jsonrpc": "2.0", "id": 2, "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "test", "version": "1.0"}
        }
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "serverInfo" in data.get("result", {})


def test_mcp_tools_list(client):
    resp = client.post("/mcp", json={"jsonrpc": "2.0", "id": 3, "method": "tools/list"})
    assert resp.status_code == 200
    tools = resp.json().get("result", {}).get("tools", [])
    assert len(tools) > 10


def test_mcp_tools_call(client):
    resp = client.post("/mcp", json={
        "jsonrpc": "2.0", "id": 4, "method": "tools/call",
        "params": {"name": "list_sessions", "arguments": {"limit": 3}}
    })
    assert resp.status_code == 200


def test_mcp_resources_list(client):
    resp = client.post("/mcp", json={"jsonrpc": "2.0", "id": 5, "method": "resources/list"})
    assert resp.status_code == 200


def test_mcp_invalid_method(client):
    resp = client.post("/mcp", json={"jsonrpc": "2.0", "id": 6, "method": "nonexistent"})
    assert resp.status_code == 200
    assert "error" in resp.json()

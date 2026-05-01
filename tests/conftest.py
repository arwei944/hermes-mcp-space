import pytest
import httpx

BASE_URL = "https://arwei944-hermes-mcp-space.hf.space"


@pytest.fixture
def base_url():
    return BASE_URL


@pytest.fixture
def client():
    return httpx.Client(base_url=BASE_URL, timeout=30.0)


@pytest.fixture
def test_session(client):
    """创建一个测试会话，测试结束后删除"""
    resp = client.post("/api/sessions", json={
        "title": "pytest-auto-session",
        "model": "test-model",
        "source": "e2e"
    })
    data = resp.json()
    session_id = data.get("id") or data.get("session", {}).get("id")
    yield session_id
    try:
        client.delete(f"/api/sessions/{session_id}")
    except Exception:
        pass


@pytest.fixture
def test_session_with_messages(client, test_session):
    """创建带消息的测试会话"""
    client.post(f"/api/sessions/{test_session}/messages", json={
        "role": "user",
        "content": "这是一条测试消息，包含代码审查和部署相关内容。参考 https://github.com/example/repo"
    })
    client.post(f"/api/sessions/{test_session}/messages", json={
        "role": "assistant",
        "content": "好的，我来分析。主要建议：\n1. 使用 JWT 认证\n2. 添加单元测试\n\n```python\ndef auth():\n    return token\n```\n\n预计性能提升 30%，响应时间从 500ms 降到 150ms。"
    })
    return test_session

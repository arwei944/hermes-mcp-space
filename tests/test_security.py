import pytest
import urllib.parse


def test_xss_prevention(client):
    q = urllib.parse.quote("<script>alert(1)</script>")
    resp = client.get(f"/api/sessions/search?q={q}")
    assert "<script>" not in resp.text


def test_sql_injection(client):
    q = urllib.parse.quote("' OR 1=1 --")
    resp = client.get(f"/api/sessions/search?q={q}")
    assert resp.status_code == 200


def test_path_traversal(client):
    resp = client.post("/api/skills", json={"name": "../../etc/passwd", "content": "x"})
    assert resp.status_code in (400, 422)


def test_long_input(client):
    long_title = "A" * 10000
    resp = client.post("/api/sessions", json={"title": long_title, "source": "test"})
    # Should either succeed or return 400/413, not 500
    assert resp.status_code in (200, 400, 413)


def test_not_found(client):
    resp = client.get("/api/nonexistent")
    assert resp.status_code == 404


def test_method_not_allowed(client):
    resp = client.put("/api/sessions", json={})
    assert resp.status_code == 405


def test_concurrent_requests(client):
    import concurrent.futures

    def fetch():
        return client.get("/api/sessions/stats").status_code

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        results = list(ex.map(fetch, range(10)))
    assert all(r == 200 for r in results)

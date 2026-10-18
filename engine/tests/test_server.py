import json
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path

from bernlife.server import BadRequest, SearchRequest, is_loopback, make_server, parse_search
from jsonschema import Draft202012Validator

CONTRACTS = Path(__file__).resolve().parents[2] / "contracts"
HEALTH = {
    "mode": "mock",
    "models": {"embed": "intfloat/multilingual-e5-small@614241f6"},
    "snapshot": "local-abc",
    "counts": {"pages": 4, "profiles": 5, "sources": 2},
}


class FakeApi:
    def __init__(self):
        self.searched: list[SearchRequest] = []

    def health(self):
        return HEALTH

    def search(self, request):
        self.searched.append(request)
        if request.query == "explode":
            raise RuntimeError("database gone: secret detail")
        return {"query": request.query}

    def profile(self, profile_id):
        return {"id": profile_id} if profile_id == "person-example-ada-muster" else None

    def source_ids(self):
        return {"demo", "example"}


class ParseSearchTest(unittest.TestCase):
    def test_a_valid_body(self):
        body = b'{"query": "  glucose  ", "lang": "en", "sources": ["example", "demo", "demo"]}'
        self.assertEqual(
            parse_search(body, {"demo", "example"}),
            SearchRequest("glucose", "en", ["demo", "example"]),
        )

    def test_bad_bodies_are_refused(self):
        for body in (
            b"not json",
            b"[]",
            b'{"query": ""}',
            b'{"query": "x", "extra": 1}',
            b'{"query": "x", "lang": "it"}',
            b'{"query": "x", "sources": ["other"]}',
            b'{"query": "x", "sources": []}',
            b'{"query": "x\\u0000y"}',
            b'{"query": "' + b"x" * 501 + b'"}',
        ):
            with self.subTest(body=body[:40]), self.assertRaises(BadRequest):
                parse_search(body, {"demo", "example"})

    def test_loopback(self):
        self.assertEqual(
            [is_loopback(h) for h in ("127.0.0.1", "::1", "10.0.0.2", "x")],
            [True, True, False, False],
        )


class ServerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.api = FakeApi()
        cls.server = make_server(cls.api, 0)
        cls.base = f"http://127.0.0.1:{cls.server.server_address[1]}"
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def call(self, path: str, body: bytes | None = None) -> tuple[int, dict]:
        request = urllib.request.Request(
            self.base + path, data=body, method="POST" if body else "GET"
        )
        try:
            with urllib.request.urlopen(request) as response:
                return response.status, json.loads(response.read())
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read())

    def test_health_validates_against_the_contract(self):
        status, body = self.call("/api/health")
        schema = json.loads((CONTRACTS / "health.schema.json").read_text())
        self.assertEqual(status, 200)
        self.assertEqual(list(Draft202012Validator(schema).iter_errors(body)), [])

    def test_search_and_profile(self):
        self.assertEqual(
            self.call("/api/search", b'{"query": "glucose"}'), (200, {"query": "glucose"})
        )
        self.assertEqual(
            self.call("/api/profile/person-example-ada-muster"),
            (200, {"id": "person-example-ada-muster"}),
        )

    def test_error_markers(self):
        self.assertEqual(self.call("/api/search", b"{oops"), (400, {"error": "bad_request"}))
        self.assertEqual(self.call("/api/profile/person-nobody"), (404, {"error": "not_found"}))
        self.assertEqual(self.call("/api/elsewhere"), (404, {"error": "not_found"}))
        with self.assertLogs("bernlife.server", "ERROR"):
            self.assertEqual(
                self.call("/api/search", b'{"query": "explode"}'), (500, {"error": "engine_error"})
            )


if __name__ == "__main__":
    unittest.main()

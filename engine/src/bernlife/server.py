"""The engine's HTTP API (contracts/api.md) on the standard library's threaded server.

Requests are parsed and checked by pure functions, then answered by an injected `Api`, so the
routing and the error markers are tested without a database or a model. Any failure the request
did not cause is logged here with its traceback and answered with the `engine_error` marker only.
"""

import ipaddress
import json
import logging
import re
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Protocol

LANGS = ("de", "en", "fr")
MAX_BODY = 16_384
MAX_QUERY = 500
PROFILE_PATH = re.compile(r"^/api/profile/([a-z0-9-]+)$")
log = logging.getLogger("bernlife.server")


class BadRequest(ValueError):
    pass


class NotFound(LookupError):
    pass


@dataclass(frozen=True)
class SearchRequest:
    query: str
    lang: str | None
    sources: list[str] | None


class Api(Protocol):
    def health(self) -> dict[str, Any]: ...
    def search(self, request: SearchRequest) -> dict[str, Any]: ...
    def profile(self, profile_id: str) -> dict[str, Any] | None: ...
    def source_ids(self) -> set[str]: ...


def parse_search(body: bytes, source_ids: set[str]) -> SearchRequest:
    try:
        payload = json.loads(body)
    except ValueError:
        raise BadRequest("not JSON") from None
    if not isinstance(payload, dict) or set(payload) - {"query", "lang", "sources"}:
        raise BadRequest("unexpected fields")
    query, lang, sources = payload.get("query"), payload.get("lang"), payload.get("sources")
    if not isinstance(query, str) or not 0 < len(query.strip()) <= MAX_QUERY:
        raise BadRequest("query")
    if lang is not None and lang not in LANGS:
        raise BadRequest("lang")
    if sources is not None and (
        not isinstance(sources, list) or not sources or not set(sources) <= source_ids
    ):
        raise BadRequest("sources")
    return SearchRequest(query.strip(), lang, sorted(set(sources)) if sources else None)


def is_loopback(host: str) -> bool:
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


def route_get(api: Api, path: str) -> dict[str, Any]:
    if path == "/api/health":
        return api.health()
    match = PROFILE_PATH.match(path)
    if match:
        profile = api.profile(match.group(1))
        if profile is not None:
            return profile
    raise NotFound(path)


def handler_class(api: Api) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            self._answer(lambda: route_get(api, self.path))

        def do_POST(self) -> None:
            self._answer(self._post)

        def _post(self) -> dict[str, Any]:
            if self.path != "/api/search":
                raise NotFound(self.path)
            length = int(self.headers.get("Content-Length") or 0)
            if not 0 < length <= MAX_BODY:
                raise BadRequest("body size")
            return api.search(parse_search(self.rfile.read(length), api.source_ids()))

        def _answer(self, respond: Callable[[], Mapping[str, Any]]) -> None:
            if self.command == "POST" and not is_loopback(self.client_address[0]):
                self._send(HTTPStatus.FORBIDDEN, {"error": "bad_request"})
                return
            try:
                self._send(HTTPStatus.OK, respond())
            except BadRequest:
                self._send(HTTPStatus.BAD_REQUEST, {"error": "bad_request"})
            except NotFound:
                self._send(HTTPStatus.NOT_FOUND, {"error": "not_found"})
            except Exception:
                log.exception("engine error on %s %s", self.command, self.path)
                self._send(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "engine_error"})

        def _send(self, status: HTTPStatus, body: Mapping[str, Any]) -> None:
            data = json.dumps(body, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, format: str, *args: object) -> None:
            log.info("%s %s", self.address_string(), format % args)

    return Handler


def make_server(api: Api, port: int, host: str = "127.0.0.1") -> ThreadingHTTPServer:
    return ThreadingHTTPServer((host, port), handler_class(api))

"""The engine's HTTP API (contracts/api.md) on the standard library's threaded server.

Requests are parsed and checked by pure functions, then answered by an injected `Api`, so the
routing and the error markers are tested without a database or a model. Any failure the request
did not cause is logged here with its traceback and answered with the `engine_error` marker only.

Only a request carrying `X-Bernlife-Live: 1` may reach the model; the web app sets it after its own
checks, and every other request is answered from the cache. Each request writes one access line
(request_log.py) in place of http.server's, which would print the raw path.
"""

import ipaddress
import json
import logging
import re
import time
from collections.abc import Callable, Mapping
from contextlib import AbstractContextManager
from dataclasses import dataclass
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Protocol

from bernlife.api_requests import BadRequest, SearchRequest, parse_agent, parse_brief, parse_search
from bernlife.cache import Message
from bernlife.request_log import Tally, access_line, new_request_id, request_mode

MAX_BODY = 16_384
MAX_BRIEF_BODY = 65_536
LIVE_HEADER = "X-Bernlife-Live"
PROFILE_PATH = re.compile(r"^/api/profile/([a-z0-9-]+)$")
PROFILE_ROUTE = "/api/profile/{id}"
ROUTES = ("/api/health", "/api/sources", "/api/numbers", "/api/search", "/api/brief", "/api/agent")
log = logging.getLogger("bernlife.server")


class NotFound(LookupError):
    pass


@dataclass(frozen=True)
class Call:
    """A parsed request: the text its log line fingerprints, and the work that answers it."""

    text: str | None
    run: Callable[[], Mapping[str, Any]]


class Api(Protocol):
    @property
    def backend(self) -> str: ...
    def scope(self, *, live: bool) -> AbstractContextManager[Tally]: ...
    def health(self) -> dict[str, Any]: ...
    def search(self, request: SearchRequest) -> dict[str, Any]: ...
    def brief(self, text: str) -> dict[str, Any]: ...
    def agent(self, messages: list[Message]) -> dict[str, Any]: ...
    def profile(self, profile_id: str) -> dict[str, Any] | None: ...
    def sources(self) -> dict[str, Any]: ...
    def numbers(self) -> dict[str, Any]: ...
    def source_ids(self) -> set[str]: ...


def is_loopback(host: str) -> bool:
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


def route_template(path: str) -> str:
    if path in ROUTES:
        return path
    return PROFILE_ROUTE if PROFILE_PATH.match(path) else "unknown"


def route_get(api: Api, path: str) -> dict[str, Any]:
    if path == "/api/health":
        return api.health()
    if path == "/api/sources":
        return api.sources()
    if path == "/api/numbers":
        return api.numbers()
    match = PROFILE_PATH.match(path)
    if match:
        profile = api.profile(match.group(1))
        if profile is not None:
            return profile
    raise NotFound(path)


def post_call(api: Api, path: str, read_body: Callable[[int], bytes]) -> Call:
    if path == "/api/search":
        request = parse_search(read_body(MAX_BODY), api.source_ids())
        return Call(request.query, lambda: api.search(request))
    if path == "/api/brief":
        text = parse_brief(read_body(MAX_BRIEF_BODY))
        return Call(text, lambda: api.brief(text))
    if path == "/api/agent":
        messages = parse_agent(read_body(MAX_BODY))
        return Call(messages[-1]["content"], lambda: api.agent(messages))
    raise NotFound(path)


def handler_class(api: Api) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            self._answer(lambda: Call(None, lambda: route_get(api, self.path)))

        def do_POST(self) -> None:
            self._answer(lambda: post_call(api, self.path, self._body))

        def _body(self, limit: int) -> bytes:
            length = self.headers.get("Content-Length") or "0"
            if not length.isdigit() or not 0 < int(length) <= limit:
                raise BadRequest("body size")
            return self.rfile.read(int(length))

        def _answer(self, parse: Callable[[], Call]) -> None:
            """The line is logged before the response goes out, so a caller that has its answer
            can rely on the line being there."""
            started = time.monotonic()
            live = self.headers.get(LIVE_HEADER) == "1"
            with api.scope(live=live) as tally:
                status, body, text = self._respond(parse)
            line = access_line(
                request_id=new_request_id(),
                route=route_template(self.path),
                method=self.command,
                status=status,
                ms=round((time.monotonic() - started) * 1000),
                mode=request_mode(api.backend, live),
                live_allowed=live,
                tally=tally,
                text=text,
            )
            log.info(line)
            self._send(status, body)

        def _respond(
            self, parse: Callable[[], Call]
        ) -> tuple[HTTPStatus, Mapping[str, Any], str | None]:
            if self.command == "POST" and not is_loopback(self.client_address[0]):
                return HTTPStatus.FORBIDDEN, {"error": "bad_request"}, None
            text = None
            try:
                call = parse()
                text = call.text
                return HTTPStatus.OK, call.run(), text
            except BadRequest:
                return HTTPStatus.BAD_REQUEST, {"error": "bad_request"}, text
            except NotFound:
                return HTTPStatus.NOT_FOUND, {"error": "not_found"}, text
            except Exception:
                log.exception("engine error on %s %s", self.command, route_template(self.path))
                return HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "engine_error"}, text

        def _send(self, status: HTTPStatus, body: Mapping[str, Any]) -> None:
            data = json.dumps(body, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def log_request(self, code: int | str = "-", size: int | str = "-") -> None:
            """_answer has logged this request already."""

        def log_message(self, format: str, *args: object) -> None:
            """Reached only for a request refused before routing; its arguments quote the raw
            request line, so only the status code is kept."""
            status = next((arg for arg in args if isinstance(arg, int)), None)
            log.info(json.dumps({"route": "unparsed", "status": status}))

    return Handler


def make_server(api: Api, port: int, host: str = "127.0.0.1") -> ThreadingHTTPServer:
    return ThreadingHTTPServer((host, port), handler_class(api))

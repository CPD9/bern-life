"""The one place the crawl touches the network.

Redirects are not followed here: the crawl decides whether a redirect target is on an allowed host
and allowed by robots.txt before anything is requested from it. A failure becomes a short marker
(`timeout`, `network`, `too_large`), never the exception text.
"""

import re
import urllib.error
import urllib.request
from dataclasses import dataclass
from email.message import Message
from http.client import HTTPException

USER_AGENT = "BernLife-Navigator/0.1 (research prototype; public pages only)"
ACCEPT = "text/html,application/xml;q=0.9,*/*;q=0.5"
TIMEOUT_S = 20
MAX_BODY_BYTES = 5_000_000
META_CHARSET = re.compile(rb"""<meta[^>]+charset=["']?([A-Za-z0-9_\-]+)""", re.IGNORECASE)


@dataclass(frozen=True)
class Response:
    status: int | None
    content_type: str = ""
    location: str | None = None
    body: str = ""
    error: str | None = None


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


_OPENER = urllib.request.build_opener(_NoRedirect)


def fetch(url: str) -> Response:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": ACCEPT})
    try:
        with _OPENER.open(request, timeout=TIMEOUT_S) as answer:
            raw = answer.read(MAX_BODY_BYTES + 1)
            headers = answer.headers
            status = answer.status
    except urllib.error.HTTPError as error:
        return Response(error.code, _content_type(error.headers), error.headers.get("Location"))
    except TimeoutError:
        return Response(None, error="timeout")
    except urllib.error.URLError as error:
        timed_out = isinstance(error.reason, TimeoutError)
        return Response(None, error="timeout" if timed_out else "network")
    except (OSError, HTTPException):
        return Response(None, error="network")
    if len(raw) > MAX_BODY_BYTES:
        return Response(status, _content_type(headers), error="too_large")
    return Response(status, _content_type(headers), headers.get("Location"), _decode(raw, headers))


def _content_type(headers: Message) -> str:
    return headers.get_content_type() if headers else ""


def _decode(raw: bytes, headers: Message) -> str:
    charset = headers.get_content_charset()
    if not charset:
        found = META_CHARSET.search(raw[:4096])
        charset = found.group(1).decode("ascii") if found else "utf-8"
    try:
        return raw.decode(charset, errors="replace")
    except LookupError:
        return raw.decode("utf-8", errors="replace")

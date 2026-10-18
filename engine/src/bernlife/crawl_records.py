"""What a crawl produces, and the pacing every request to a host goes through."""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime

from bernlife.sources import Site

Clock = Callable[[], float]
Sleep = Callable[[float], None]


@dataclass(frozen=True)
class Event:
    url: str
    source_id: str
    host: str
    status: int | None
    outcome: str


@dataclass(frozen=True)
class RawPage:
    url: str
    fetched_at: str
    status: int
    html: str


@dataclass(frozen=True)
class SiteResult:
    site: Site
    pages: tuple[RawPage, ...]
    events: tuple[Event, ...]
    stopped: str | None  # robots_unreachable | blocked | unreachable | engine_error


class Pacer:
    """At least `delay` seconds between the starts of two requests to the same host."""

    def __init__(self, delay: float, clock: Clock, sleep: Sleep) -> None:
        self.delay = delay
        self._clock = clock
        self._sleep = sleep
        self._last: float | None = None

    def wait(self) -> None:
        if self._last is not None:
            remaining = self._last + self.delay - self._clock()
            if remaining > 0:
                self._sleep(remaining)
        self._last = self._clock()


class HostStopped(Exception):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


def stamp(seconds: float) -> str:
    return datetime.fromtimestamp(seconds, UTC).strftime("%Y-%m-%dT%H:%M:%SZ")

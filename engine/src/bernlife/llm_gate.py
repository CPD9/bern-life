"""Which model calls may reach the model: the request scope, the daily budget, and the failures
health reports.

The server is cache-only unless a request runs inside `request_scope(live=True)`, which it opens
only for a request the web app marked live, so a code path that forgets the scope fails closed. A
worker thread starts without its caller's context, so a thread pool on a request path maps through
`map_in_scope`. LLM_CALL_BUDGET caps live calls per UTC day: a call is reserved under a lock
before it is made, so parallel requests cannot overshoot, and the day's count is read back from
the audit at start.
"""

import threading
from collections import Counter, deque
from collections.abc import Callable, Iterator, Mapping, Sequence
from concurrent.futures import Executor
from contextlib import contextmanager
from contextvars import ContextVar, copy_context
from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

from .cache import CacheMiss, audit_records

NO_CALL = frozenset({"hit", "miss", "budget"})
KEPT_FAILURES = 1000


class BudgetUsed(CacheMiss):
    """A miss that could have gone live, refused because today's budget is spent."""


@dataclass
class CallTally:
    """How one request's model calls were answered; the server's request log reads it."""

    hits: int = 0
    misses: int = 0
    live: int = 0
    failures: int = 0
    _lock: threading.Lock = field(
        default_factory=threading.Lock, init=False, repr=False, compare=False
    )

    def count(self, outcome: str) -> None:
        with self._lock:
            if outcome == "hit":
                self.hits += 1
            elif outcome in ("miss", "budget"):
                self.misses += 1
            elif outcome == "live":
                self.live += 1
            else:
                self.failures += 1


@dataclass(frozen=True)
class _Scope:
    live: bool
    tally: CallTally


_scope: ContextVar[_Scope | None] = ContextVar("bernlife_request_scope", default=None)


@contextmanager
def request_scope(*, live: bool) -> Iterator[CallTally]:
    """One request's model calls; with live=False every one is answered from the cache."""
    tally = CallTally()
    token = _scope.set(_Scope(live, tally))
    try:
        yield tally
    finally:
        _scope.reset(token)


def map_in_scope[T, R](pool: Executor, work: Callable[[T], R], items: Sequence[T]) -> list[R]:
    """`pool.map` with each task in its own copy of the caller's context: one context cannot run
    in two threads at once."""
    contexts = [copy_context() for _ in items]
    return list(pool.map(lambda context, item: context.run(work, item), contexts, items))


def may_go_live(serving: bool) -> bool:
    """Inside a request scope as the scope says; outside one only when not serving."""
    scope = _scope.get()
    return scope.live if scope is not None else not serving


def answered_mode(backend: str, live_calls: int) -> str:
    """What answered: a live engine whose calls all came from the cache answered as replay."""
    return "replay" if backend == "live" and live_calls == 0 else backend


def request_mode(backend: str) -> str:
    """`answered_mode` of the request in scope; outside one, a command's, as the backend says."""
    scope = _scope.get()
    return backend if scope is None else answered_mode(backend, scope.tally.live)


def count_call(outcome: str) -> None:
    scope = _scope.get()
    if scope is not None:
        scope.tally.count(outcome)


def is_failure(outcome: str) -> bool:
    return outcome not in NO_CALL and outcome != "live"


def calls_on(root: Path, day: date) -> int:
    """The calls the audit shows reaching the model on a UTC day; a failed one was spent too."""
    return sum(
        1
        for record in audit_records(root)
        if isinstance(record.get("outcome"), str)
        and record["outcome"] not in NO_CALL
        and _day_of(record) == day
    )


def _day_of(record: Mapping[str, Any]) -> date | None:
    try:
        return datetime.fromisoformat(record["ts"]).astimezone(UTC).date()
    except (KeyError, TypeError, ValueError):
        return None


class DailyBudget:
    """Live calls per UTC day against a cap; the count starts from what the audit shows today."""

    def __init__(self, limit: int, audit_root: Path, now: Callable[[], datetime]) -> None:
        self.limit, self._now = limit, now
        self._day = now().date()
        self._used = calls_on(audit_root, self._day)
        self._lock = threading.Lock()

    def reserve(self) -> bool:
        with self._lock:
            self._roll_day()
            if self._used >= self.limit:
                return False
            self._used += 1
            return True

    def status(self) -> dict[str, int]:
        with self._lock:
            self._roll_day()
            return {"limit": self.limit, "used": self._used}

    def _roll_day(self) -> None:
        today = self._now().date()
        if today != self._day:
            self._day, self._used = today, 0


class FailureLog:
    """The last KEPT_FAILURES failure markers, by when, role and marker."""

    def __init__(self) -> None:
        self._failures: deque[tuple[datetime, str, str]] = deque(maxlen=KEPT_FAILURES)
        self._lock = threading.Lock()

    def record(self, at: datetime, role: str, marker: str) -> None:
        with self._lock:
            self._failures.append((at, role, marker))

    def since(self, start: datetime) -> dict[str, dict[str, int]]:
        with self._lock:
            recent = Counter((role, marker) for at, role, marker in self._failures if at >= start)
        by_role: dict[str, dict[str, int]] = {}
        for (role, marker), count in sorted(recent.items()):
            by_role.setdefault(role, {})[marker] = count
        return by_role

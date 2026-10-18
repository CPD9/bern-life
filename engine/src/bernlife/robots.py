"""robots.txt as RFC 9309 reads it.

`urllib.robotparser` matches rules as plain prefixes, but most UniBE sites write rules such as
`Disallow: /*index.html` and `Disallow: /*?preview$`, which it would read as allowing everything.
Here `*` matches any run of characters, a final `$` anchors the end, the longest matching rule
wins and Allow wins a tie between equally long rules.
"""

import math
import re
from dataclasses import dataclass, field

from bernlife.urls import path_and_query

PRODUCT_TOKEN = "bernlife-navigator"


@dataclass(frozen=True)
class Rule:
    allow: bool
    pattern: str
    regex: re.Pattern[str] = field(compare=False)


@dataclass(frozen=True)
class Robots:
    rules: tuple[Rule, ...]
    crawl_delay: float | None
    sitemaps: tuple[str, ...]

    def allows(self, url: str) -> bool:
        target = path_and_query(url)
        matching = [rule for rule in self.rules if rule.regex.match(target)]
        if not matching:
            return True
        best = max(matching, key=lambda rule: (len(rule.pattern), rule.allow))
        return best.allow


ALLOW_ALL = Robots((), None, ())


@dataclass
class _Group:
    agents: list[str] = field(default_factory=list)
    rules: list[Rule] = field(default_factory=list)
    delays: list[float] = field(default_factory=list)


def parse(text: str, token: str = PRODUCT_TOKEN) -> Robots:
    groups: list[_Group] = []
    sitemaps: list[str] = []
    current: _Group | None = None
    for raw_line in text.splitlines():
        key, _, value = raw_line.split("#", 1)[0].partition(":")
        key, value = key.strip().lower(), value.strip()
        if key == "user-agent":
            if current is None or current.rules or current.delays:
                current = _Group()
                groups.append(current)
            current.agents.append(value.lower())
        elif key == "sitemap" and value:
            sitemaps.append(value)
        elif current is not None and key in ("allow", "disallow") and value:
            current.rules.append(Rule(key == "allow", value, _compile(value)))
        elif current is not None and key == "crawl-delay":
            delay = _number(value)
            if delay is not None:
                current.delays.append(delay)
    chosen = [g for g in groups if token in g.agents] or [g for g in groups if "*" in g.agents]
    delays = [delay for group in chosen for delay in group.delays]
    return Robots(
        rules=tuple(rule for group in chosen for rule in group.rules),
        crawl_delay=max(delays) if delays else None,
        sitemaps=tuple(sitemaps),
    )


def _compile(pattern: str) -> re.Pattern[str]:
    anchored = pattern.endswith("$")
    body = pattern[:-1] if anchored else pattern
    regex = ".*".join(re.escape(part) for part in body.split("*"))
    return re.compile(regex + ("$" if anchored else ""))


def _number(value: str) -> float | None:
    try:
        number = float(value)
    except ValueError:
        return None
    return number if math.isfinite(number) and number >= 0 else None

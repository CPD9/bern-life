"""Settings from the environment, read in one place and only when asked for.

Importing the engine never needs a `.env`; a bad value fails where it is used, by its name.
"""

import os
from collections.abc import Mapping
from dataclasses import dataclass, field
from pathlib import Path

BACKENDS = ("live", "replay", "mock")
DEFAULT_MAX_CONCURRENCY = 4


class ConfigError(ValueError):
    pass


@dataclass(frozen=True)
class Endpoint:
    base_url: str
    api_key: str = field(repr=False)
    model: str


def data_dir(env: Mapping[str, str] = os.environ) -> Path:
    """BERNLIFE_DATA_DIR, else `data/` under the working directory: the repo root for make
    targets, and /app in the engine image, which installs the package into site-packages and
    mounts the data at /app/data, so the package's own location says nothing about it."""
    raw = env.get("BERNLIFE_DATA_DIR", "")
    return Path(raw).expanduser() if raw else Path.cwd() / "data"


def llm_endpoint(env: Mapping[str, str] = os.environ) -> Endpoint | None:
    """The 70B route (EXPAND_LLM_*) for every role when it is set, else LLM_*.

    The 8B accepted invented details about people in 15 of 18 answers, so no role may land on it
    while a 70B endpoint is configured. The three values of a route are taken together: mixing a
    70B URL with an 8B model name would quietly undo that rule.
    """
    for prefix in ("EXPAND_LLM_", "LLM_"):
        base_url = env.get(f"{prefix}BASE_URL", "")
        if base_url:
            return Endpoint(
                base_url=base_url.rstrip("/"),
                api_key=env.get(f"{prefix}API_KEY", ""),
                model=env.get(f"{prefix}MODEL", ""),
            )
    return None


def backend(env: Mapping[str, str] = os.environ) -> str:
    """`live`, `replay`, `mock`, or empty: live if the endpoint answers, else replay, else mock."""
    value = env.get("BERNLIFE_BACKEND", "").strip().lower()
    if value and value not in BACKENDS:
        raise ConfigError(f"BERNLIFE_BACKEND must be live, replay or mock, not {value!r}")
    return value


def max_concurrency(env: Mapping[str, str] = os.environ) -> int:
    raw = env.get("LLM_MAX_CONCURRENCY", "")
    if not raw:
        return DEFAULT_MAX_CONCURRENCY
    if not raw.isdigit() or int(raw) < 1:
        raise ConfigError(f"LLM_MAX_CONCURRENCY must be a whole number of at least 1, not {raw!r}")
    return int(raw)

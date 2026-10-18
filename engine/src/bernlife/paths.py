"""Where the engine finds its configs and keeps its data.

The repo root is the nearest folder above this package (or above the working directory, for an
installed copy) that holds `contracts/`, so a command finds the same files from any folder.
BERNLIFE_DATA_DIR moves the data out of the worktree, which lets every worktree share one crawl.
"""

import os
from collections.abc import Mapping
from functools import cache
from pathlib import Path


class RepoRootNotFound(RuntimeError):
    pass


@cache
def repo_root() -> Path:
    for start in (Path(__file__).resolve(), Path.cwd().resolve()):
        for folder in start.parents if start.is_file() else (start, *start.parents):
            if (folder / "contracts").is_dir():
                return folder
    raise RepoRootNotFound("no folder with contracts/ above the engine or the working directory")


def data_dir(env: Mapping[str, str] = os.environ) -> Path:
    configured = env.get("BERNLIFE_DATA_DIR")
    return Path(configured).expanduser() if configured else repo_root() / "data"


def sources_dir() -> Path:
    return repo_root() / "sources"


def contract(name: str) -> Path:
    return repo_root() / "contracts" / name


def bundle_dir() -> Path:
    return data_dir() / "bundle"


def crawl_dir() -> Path:
    return data_dir() / "crawl"

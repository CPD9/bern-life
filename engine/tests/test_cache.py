import json
import lzma
import tempfile
import unittest
from pathlib import Path

from bernlife.cache import (
    PACK,
    cache_key,
    count_entries,
    entry_path,
    lookup,
    write_json,
)

MODEL = "swiss-ai/Apertus-v1.5-70B"
MESSAGES = [{"role": "user", "content": "Glukosesensoren in Bern"}]
REQUEST_SHA256 = "a2a30718ebee8cdfb44d090e2d1d1d7dbc650e6d06ab0139d13f59259e59b968"


def write_pack(root: Path, entries: dict[str, str]) -> None:
    root.mkdir(parents=True, exist_ok=True)
    with lzma.open(root / PACK, "wt", encoding="utf-8") as pack:
        for key, content in entries.items():
            pack.write(json.dumps({"key": key, "content": content}) + "\n")


class CacheTest(unittest.TestCase):
    def setUp(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.live = Path(tmp.name) / "llm_cache"
        self.bundle = Path(tmp.name) / "bundle" / "llm_cache"

    def test_fixed_request_has_exact_key(self) -> None:
        self.assertEqual(cache_key(MODEL, MESSAGES, 0.0, None, 700, "expand-v1"), REQUEST_SHA256)

    def test_prompt_version_changes_the_key(self) -> None:
        self.assertEqual(
            cache_key(MODEL, MESSAGES, 0.0, None, 700, "expand-v2"),
            "d9c4cb7e2c529577ea5aa0a0fa59fde403ac621fa100d04c0cc9ee8e5b756664",
        )

    def test_own_file_wins_over_pack(self) -> None:
        write_pack(self.live, {REQUEST_SHA256: "packed"})
        self.assertEqual(lookup([self.live], REQUEST_SHA256), {"content": "packed"})
        write_json(entry_path(self.live, REQUEST_SHA256), {"content": "own"})
        self.assertEqual(lookup([self.live], REQUEST_SHA256), {"content": "own"})

    def test_bundle_pack_is_read_after_live_root(self) -> None:
        write_pack(self.bundle, {REQUEST_SHA256: "from bundle"})
        self.assertEqual(
            lookup([self.live, self.bundle], REQUEST_SHA256), {"content": "from bundle"}
        )
        self.assertIsNone(lookup([self.live, self.bundle], "0" * 64))

    def test_failed_write_leaves_no_file(self) -> None:
        path = entry_path(self.live, REQUEST_SHA256)
        with self.assertRaises(TypeError):
            write_json(path, {"content": object()})
        self.assertEqual(list(path.parent.iterdir()), [])

    def test_count_entries_counts_own_files_and_pack_lines(self) -> None:
        write_json(entry_path(self.live, REQUEST_SHA256), {"content": "a"})
        write_json(entry_path(self.live, "ff" + REQUEST_SHA256[2:]), {"content": "b"})
        write_json(self.live / "models.json", {"expand": MODEL})
        write_pack(self.bundle, {"0" * 64: "c"})
        self.assertEqual(count_entries([self.live, self.bundle]), {"files": 2, "pack": 1})


if __name__ == "__main__":
    unittest.main()

import json
import tempfile
import unittest
from pathlib import Path

from bernlife.cache import MODELS, PACK, entry_path, lookup, read_pack, write_json

from infra.pack_cache import PackError, encode, pack, prune, replace_checked

KEY_A, KEY_B, KEY_C = "a" * 64, "b" * 64, "c" * 64


def entry(content: str) -> dict[str, str]:
    return {"role": "expand", "model": "apertus-v1-5-70b", "content": content}


class PackCacheTest(unittest.TestCase):
    def setUp(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.live = Path(tmp.name) / "llm_cache"
        self.bundle = Path(tmp.name) / "bundle" / "llm_cache"
        self.bundle.mkdir(parents=True)
        (self.bundle / PACK).write_bytes(encode({KEY_A: entry("old a"), KEY_B: entry("old b")}))
        write_json(entry_path(self.live, KEY_B), entry("new b"))
        write_json(entry_path(self.live, KEY_C), entry("new c"))
        write_json(self.live / MODELS, {"expand": "apertus-v1-5-70b"})

    def test_pack_holds_old_entries_and_own_files_with_own_files_winning(self) -> None:
        entries, files = pack(self.live, self.bundle)
        expected = {KEY_A: entry("old a"), KEY_B: entry("new b"), KEY_C: entry("new c")}
        self.assertEqual((entries, sorted(files)), (expected, [KEY_B, KEY_C]))
        self.assertEqual(read_pack(self.bundle / PACK), expected)
        self.assertEqual(
            json.loads((self.bundle / MODELS).read_text()), {"expand": "apertus-v1-5-70b"}
        )

    def test_same_entries_give_the_same_bytes(self) -> None:
        pack(self.live, self.bundle)
        first = (self.bundle / PACK).read_bytes()
        pack(self.live, self.bundle)
        self.assertEqual((self.bundle / PACK).read_bytes(), first)

    def test_prune_removes_folded_files_and_replay_still_finds_them(self) -> None:
        entries, files = pack(self.live, self.bundle)
        self.assertEqual(prune(entries, files), 2)
        self.assertEqual(sorted(p.name for p in self.live.iterdir()), [MODELS])
        self.assertEqual(lookup([self.live, self.bundle], KEY_C), entry("new c"))

    def test_a_pack_that_does_not_read_back_equal_is_not_swapped_in(self) -> None:
        before = (self.bundle / PACK).read_bytes()
        with self.assertRaises(PackError):
            replace_checked(self.bundle / PACK, encode({KEY_A: entry("x")}), {KEY_A: entry("y")})
        self.assertEqual((self.bundle / PACK).read_bytes(), before)
        self.assertFalse((self.bundle / f"{PACK}.new").exists())


if __name__ == "__main__":
    unittest.main()

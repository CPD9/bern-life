import json
import tempfile
import unittest
from pathlib import Path

from bernlife.crawl_records import RawPage
from bernlife.snapshot import load_raw, page_record, replace_lines, save_raw
from fakes import HOST, site

ROOT = f"https://{HOST}"
HTML = "<html lang='en'><title>Ada</title><p>Dr. Ada\u00a0Muster leads the Sensor Lab.</p></html>"


class PageRecordTest(unittest.TestCase):
    def test_record(self):
        raw = RawPage(f"{ROOT}/team/ada-muster", "2026-10-18T12:00:04Z", 200, HTML)
        text = "Dr. Ada Muster leads the Sensor Lab."
        self.assertEqual(
            page_record(site(), raw),
            {
                "url": f"{ROOT}/team/ada-muster",
                "source_id": "example",
                "unit": "Example Institute for Engineering",
                "fetched_at": "2026-10-18T12:00:04Z",
                "sha256": "ac5ede37eddeb8ff5cbd31309e4adfd43441895d21639e546f1fa911bfb786c7",
                "status": 200,
                "lang": "en",
                "title": "Ada",
                "kind": "person",
                "text": text,
            },
        )


class FilesTest(unittest.TestCase):
    def setUp(self):
        self.folder = Path(tempfile.mkdtemp())

    def test_replace_lines_keeps_other_sources_and_sorts_by_url(self):
        path = self.folder / "pages.jsonl"
        replace_lines(path, [{"url": "https://b.test/", "source_id": "b"}], {"b"})
        replace_lines(path, [{"url": "https://c.test/", "source_id": "a"}], {"a"})
        replace_lines(path, [{"url": "https://a.test/", "source_id": "a"}], {"a"})
        lines = [json.loads(line) for line in path.read_text().splitlines()]
        self.assertEqual(
            lines,
            [
                {"url": "https://a.test/", "source_id": "a"},
                {"url": "https://b.test/", "source_id": "b"},
            ],
        )

    def test_raw_html_round_trip_is_byte_stable(self):
        pages = [RawPage(f"{ROOT}/", "2026-10-18T12:00:04Z", 200, HTML)]
        save_raw(self.folder, site(), pages)
        first = (self.folder / "html" / f"{HOST}.jsonl.gz").read_bytes()
        save_raw(self.folder, site(), pages)
        self.assertEqual((self.folder / "html" / f"{HOST}.jsonl.gz").read_bytes(), first)
        self.assertEqual(load_raw(self.folder, site()), pages)

    def test_missing_raw_html(self):
        self.assertIsNone(load_raw(self.folder, site()))


if __name__ == "__main__":
    unittest.main()

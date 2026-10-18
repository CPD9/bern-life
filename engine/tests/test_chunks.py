import hashlib
import unittest

from bernlife.chunks import (
    build_chunks,
    cited_urls,
    page_passages,
    profile_chunk,
    vector_key,
    windows,
)
from search_fakes import ADA_PAGE, DORA_PAGE, PAGES, PATCH_PAGE, PROFILES, RELATIONS


class WindowsTest(unittest.TestCase):
    def test_whole_lines_up_to_the_limit(self):
        self.assertEqual(windows("aaaa\nbbbb\ncccc\n\ndd", limit=9), ["aaaa\nbbbb", "cccc\n\ndd"])

    def test_a_long_line_is_cut_at_spaces(self):
        self.assertEqual(windows("one two three four", limit=8), ["one two", "three", "four"])

    def test_every_window_is_verbatim_page_text(self):
        text = str(PATCH_PAGE["text"])
        self.assertTrue(all(window in text for window in windows(text, limit=40)))


class ChunksTest(unittest.TestCase):
    def test_profile_chunk_is_the_name_then_the_fields_in_contract_order(self):
        ada = profile_chunk(PROFILES[1])
        self.assertEqual(
            (ada.id, ada.kind, ada.profile_id, ada.page_url, ada.source_id),
            (
                "person-example-ada-muster",
                "profile",
                "person-example-ada-muster",
                ADA_PAGE["url"],
                "example",
            ),
        )
        self.assertEqual(
            ada.text,
            "Ada Muster\nGroup Leader\nSensor Lab\n"
            "continuous glucose monitoring\nwearable biosensors",
        )

    def test_passages_carry_the_title_and_a_stable_id(self):
        (passage,) = page_passages(DORA_PAGE)
        self.assertEqual(passage.id, f"page-{str(DORA_PAGE['sha256'])[:16]}-0")
        self.assertEqual(passage.text, f"{DORA_PAGE['title']}\n{DORA_PAGE['text']}")
        self.assertIsNone(passage.profile_id)

    def test_only_cited_pages_are_cut(self):
        uncited = {**DORA_PAGE, "url": "https://www.example-institute.test/news"}
        chunks = build_chunks([*PAGES, uncited], PROFILES, RELATIONS)
        self.assertNotIn(uncited["url"], {chunk.page_url for chunk in chunks})
        self.assertEqual(len(chunks), len(PROFILES) + len(PAGES))
        self.assertEqual(cited_urls(PROFILES, RELATIONS), {page["url"] for page in PAGES})

    def test_vector_key_is_the_hash_of_the_prefixed_text(self):
        self.assertEqual(vector_key("abc"), hashlib.sha256(b"passage: abc").hexdigest())


if __name__ == "__main__":
    unittest.main()

import json
import tempfile
import unittest
from pathlib import Path

from bernlife import paths
from bernlife.sources import SourceError, load_sources

FIXTURE = paths.repo_root() / "contracts" / "fixtures" / "source.json"


class RealSourcesTest(unittest.TestCase):
    def test_the_case_sources_and_the_opportunity_sources_load(self):
        sources = load_sources()
        self.assertEqual(
            [s.id for s in sources],
            ["artorg", "beda", "dcb", "effinger", "innosuisse", "progr", "sipbb", "snsf", "unibe"],
        )
        self.assertEqual(sum(len(s.sites) for s in sources), 28)


class BrokenSourceTest(unittest.TestCase):
    def setUp(self):
        self.folder = Path(tempfile.mkdtemp())
        self.fixture = json.loads(FIXTURE.read_text())

    def write(self, name: str, doc: object) -> None:
        (self.folder / name).write_text(json.dumps(doc))

    def assert_error(self, message: str) -> None:
        with self.assertRaises(SourceError) as caught:
            load_sources(self.folder)
        self.assertEqual(str(caught.exception), message)

    def test_fixture_loads_as_one_site(self):
        self.write("example.json", self.fixture)
        [source] = load_sources(self.folder)
        self.assertEqual(source.sites[0].allow_paths, ("/team/", "/research/"))
        self.assertEqual(source.sites[0].max_depth, 3)

    def test_schema_error_names_file_and_field(self):
        del self.fixture["crawl"]["delay_s"]
        self.write("example.json", self.fixture)
        self.assert_error("example.json: $.crawl: 'delay_s' is a required property")

    def test_invalid_json(self):
        (self.folder / "broken.json").write_text('{"id": ')
        self.assert_error("broken.json: not valid JSON (line 1)")

    def test_seed_on_another_host(self):
        self.fixture["sites"][0]["seeds"] = ["https://www.unibe.test/"]
        self.write("example.json", self.fixture)
        self.assert_error(
            "example.json: $.sites[0].seeds: https://www.unibe.test/ is not on "
            "www.example-institute.test"
        )

    def test_host_in_two_files(self):
        self.write("a.json", self.fixture)
        self.write("b.json", {**self.fixture, "id": "other"})
        self.assert_error("host listed twice: www.example-institute.test")


if __name__ == "__main__":
    unittest.main()

import io
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from typing import Any

from evaluator.dev2_check import main, personal, titled_names
from records import page, profile

Record = dict[str, Any]
LAB = "https://www.example.test/lab/ada"
TEAM = "https://www.example.test/team/"
GOLD_PAGE = "https://www.example.test/gold/zoe"
DEV_PAGE = "https://www.example.test/dev/ida"


def line(qid: str, name: str = "Ada Muster", url: str = LAB, span: str = "works on tides", **kw):
    row: Record = {"id": qid, "query": f"Who works on {qid}?", "lang": "en", "variant": "site"}
    row |= {"sources": ["unibe"], "notes": "dev 2026-10-19: written from the proof page"}
    row["expect"] = {"abstain": False, "people": [{"name": name, "proof_url": url}]}
    if span:
        row["expect"]["people"][0]["proof_span"] = span
    return row | kw


def invented(qid: str, query: str, sources: tuple[str, ...] = ("unibe",)) -> Record:
    row: Record = {"id": qid, "query": query, "lang": "fr", "variant": "invented"}
    return row | {"sources": list(sources), "expect": {"abstain": True}}


def write(path: Path, rows: list[Record]) -> Path:
    path.write_text("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows))
    return path


class TitledNamesTest(unittest.TestCase):
    def test_names_after_titles_in_three_languages(self) -> None:
        self.assertEqual(titled_names("Welche Studien leitet PD Dr. Zoé Muster?"), ["Zoé Muster"])
        self.assertEqual(titled_names("Que publie la Dre Zoé Muster sur"), ["Zoé Muster"])
        self.assertEqual(titled_names("What has Prof. Ada Lind-Ek published?"), ["Ada Lind-Ek"])
        self.assertEqual(titled_names("Which hotels near the station have a spa?"), [])

    def test_personal_finds_mail_and_phones_but_not_dates(self) -> None:
        self.assertTrue(personal("write to ada.muster@example.test"))
        self.assertTrue(personal("call +41 31 000 00 00"))
        self.assertFalse(personal("dev2 2026-10-19: written in 2025-2026"))


class Dev2CheckTest(unittest.TestCase):
    def setUp(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.dir = Path(tmp.name)
        pages = [
            page(LAB, "Ada Muster\nworks on tides and waves."),
            page(TEAM, "Team: Prof. Lena Quast, Ida Brun"),
            page(GOLD_PAGE, "Zoë Müller works on tides."),
        ]
        profiles = [
            profile("person-a", "person", "Ada Muster", LAB),
            profile("person-l", "person", "Lena Quast", TEAM),
        ]
        gold = [line("q001", "Zoë Müller", "http://www.example.test/gold/zoe/")]
        dev = [line("q901", "Ida Brun", DEV_PAGE)]
        self.args = ["--pages", str(write(self.dir / "pages.jsonl", pages))]
        self.args += ["--profiles", str(write(self.dir / "profiles.jsonl", profiles))]
        self.args += ["--gold", str(write(self.dir / "gold.jsonl", gold))]
        self.args += ["--dev", str(write(self.dir / "dev.jsonl", dev))]

    def check(self, rows: list[Record]) -> tuple[int, str, list[str]]:
        out, keep = io.StringIO(), self.dir / "kept.jsonl"
        with redirect_stdout(out):
            code = main([str(write(self.dir / "new.jsonl", rows)), *self.args, "--keep", str(keep)])
        kept = [json.loads(row)["id"] for row in keep.read_text().splitlines()]
        return code, out.getvalue(), kept

    def failures(self, report: str) -> dict[str, str]:
        found = {}
        for text in report.splitlines():
            if text.strip().startswith("FAIL "):
                qid, problems = text.strip().removeprefix("FAIL ").split(": ", 1)
                found[qid] = problems
        return found

    def test_a_clean_set_passes_with_spaces_normalised(self) -> None:
        rows = [line("q930"), invented("q931", "Que publie la Dre Zoé Nouvelle ?")]
        rows.append(invented("q932", "Which hotels near the station have a spa?", sources=()))
        code, report, kept = self.check(rows)
        self.assertEqual(code, 0, report)
        self.assertEqual(kept, ["q930", "q931", "q932"])
        self.assertIn("3 lines, 3 pass every check", report)
        self.assertIn("1 expected entities, 1 by name", report)

    def test_each_check_names_the_line_that_breaks_it(self) -> None:
        rows = [
            line("q930"),
            line("q930"),
            line("q940", span="Works on tides"),
            line("q941", url="https://www.example.test/not-stored"),
            line("q942", span=""),
            line("q943", name="Eva Lind", url=GOLD_PAGE),
            line("q944", name="Prof. Dr. Zoe Muller"),
            line("q945", name="Ida Brun"),
            line("q946", url=TEAM, span="Team:", lang="xx"),
            invented("q950", "Que publie la Dre Lena Quast ?"),
            invented("q951", "Que publie le Dr Hugo Brun ?"),
            invented("q952", "Que publie-t-on sur les marées ?"),
            line("q960", notes="contact ada.muster@example.test"),
        ]
        code, report, kept = self.check(rows)
        self.assertEqual(code, 1)
        self.assertEqual(kept, ["q930"])
        failed = self.failures(report)
        self.assertEqual(failed["q930"], "schema (duplicate id)")
        self.assertEqual(failed["q940"], "span (person: span not on the page)")
        self.assertEqual(failed["q941"], "span (person: proof page not in the snapshot)")
        self.assertEqual(failed["q942"], "span (person: no proof_span)")
        self.assertEqual(failed["q943"], "gold_url")
        self.assertEqual(failed["q944"], "gold_name")
        self.assertEqual(failed["q945"], "dev (person)")
        self.assertEqual(failed["q946"], "schema ($.lang)")
        self.assertEqual(failed["q950"], "invented (Lena Quast is in the snapshot)")
        self.assertEqual(failed["q951"], "invented (Hugo Brun is in the snapshot)")
        self.assertEqual(failed["q952"], "invented (no titled name)")
        self.assertEqual(failed["q960"], "personal (e-mail or phone number)")
        self.assertNotIn("Zoë", report)

    def test_shape_must_fit_the_variant(self) -> None:
        wrong = invented("q930", "Que publie la Dre Zoé Nouvelle ?")
        wrong["expect"]["people"] = [{"name": "Ada Muster", "proof_url": LAB}]
        empty = line("q931")
        empty["expect"] = {"abstain": False}
        code, report, _ = self.check([wrong, empty])
        failed = self.failures(report)
        self.assertEqual(code, 1)
        self.assertTrue(failed["q930"].startswith("schema (invented but expects results)"))
        self.assertEqual(failed["q931"], "schema (expects no result)")


if __name__ == "__main__":
    unittest.main()

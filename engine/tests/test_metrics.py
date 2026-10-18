import copy
import json
import unittest
from pathlib import Path

from bernlife.metrics import Topic, query_topics, with_metrics
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

CONTRACTS = Path(__file__).resolve().parents[2] / "contracts"
SHA = "0" * 64

GLUCOSE = Topic(
    "glucose sensors", ("glucose sensors", "CGM", "continuous glucose monitoring", "Glukosesensor")
)
WEARABLES = Topic("wearables", ("wearables", "smartwatch", "wearable sensor"))
CHILDREN = Topic("children", ("children", "paediatric", "Kinder"))
TOPICS = [GLUCOSE, WEARABLES, CHILDREN]

FILLER = " " + "." * 398 + " "
PAGES = {
    "https://dcb.test/team/ada": {
        "unit": "Invented Diabetes Unit",
        "text": "Dr. Ada Example, group leader in the Invented Diabetes Unit, develops continuous "
        "glucose monitoring with a wearable sensor.",
    },
    "https://dcb.test/team/bea": {
        "unit": "Invented Diabetes Unit",
        "text": "Bea Example, research associate." + FILLER + "Her work covers CGM data quality.",
    },
    "https://artorg.test/labs/sensor": {
        "unit": "Invented Engineering Unit",
        "text": "The Sensor Lab builds Glukosesensor prototypes.",
    },
    "https://artorg.test/news/kids": {
        "unit": "Invented Engineering Unit",
        "text": "A new study on paediatric diabetes care was announced.",
    },
}


def claim(url: str, span: str, value: str | None = None) -> dict:
    start = PAGES[url]["text"].index(span)
    evidence = {"page_url": url, "page_sha256": SHA, "span": span, "start": start}
    return {"value": value or span, "method": "selector", "evidence": evidence}


def profile(pid: str, kind: str, name: claim, url: str, **fields: list) -> dict:
    empty = {
        "role": [],
        "unit": [],
        "expertise": [],
        "projects": [],
        "infrastructure": [],
        "services": [],
    }
    return {
        "id": pid,
        "kind": kind,
        "source_id": "invented",
        "name": name,
        "source_url": url,
        "fields": empty | fields,
    }


def result(rank: int, prof: dict) -> dict:
    reason = {"text": "Invented reason.", "cites": ["/name"]}
    return {"rank": rank, "profile": prof, "reason": reason, "score": {"fused": 0.5}}


ADA, BEA = "https://dcb.test/team/ada", "https://dcb.test/team/bea"
LAB, NEWS = "https://artorg.test/labs/sensor", "https://artorg.test/news/kids"


def worked_example() -> dict:
    """A: both of its topics beside her name → relevance 2/3, evidence 1.0, 3 of 5 fields.
    B: CGM far below her name on her page → 1/3, evidence 0.5, same unit, adds nothing.
    C: Glukosesensor (an expansion) beside the lab's name (1.0), paediatric only on a news page
    that does not name it (0.25) → 2/3, evidence 0.625, new unit, adds children."""
    ada = profile(
        "person-ada",
        "person",
        claim(ADA, "Dr. Ada Example", "Ada Example"),
        ADA,
        role=[claim(ADA, "group leader")],
        unit=[claim(ADA, "Invented Diabetes Unit")],
        expertise=[claim(ADA, "develops continuous glucose monitoring with a wearable sensor")],
    )
    bea = profile(
        "person-bea",
        "person",
        claim(BEA, "Bea Example"),
        BEA,
        role=[claim(BEA, "research associate")],
        expertise=[claim(BEA, "CGM data quality")],
    )
    lab = profile(
        "unit-sensor-lab",
        "unit",
        claim(LAB, "The Sensor Lab", "Sensor Lab"),
        LAB,
        expertise=[
            claim(LAB, "builds Glukosesensor prototypes"),
            claim(NEWS, "paediatric diabetes care"),
        ],
        infrastructure=[claim(LAB, "prototypes")],
    )
    versions = {"engine": "test", "snapshot": "test", "prompts": "test"}
    return {
        "query": "Who works on glucose sensors and wearables for children?",
        "mode": "mock",
        "abstained": False,
        "expanded_terms": [],
        "versions": versions,
        "results": [result(1, ada), result(2, bea), result(3, lab)],
    }


class MetricsTest(unittest.TestCase):
    def metrics(self, response: dict) -> list[dict]:
        return [r["metrics"] for r in with_metrics(response, TOPICS, PAGES.get)["results"]]

    def test_worked_example_gives_exact_values(self) -> None:
        a, b, c = self.metrics(worked_example())
        self.assertEqual(
            a,
            {
                "relevance": 0.6667,
                "covers": ["glucose sensors", "wearables"],
                "missing": ["children"],
                "evidence": 1.0,
                "completeness": {"filled": 3, "of": 5},
                "novelty": {"new_unit": True, "adds": ["glucose sensors", "wearables"]},
                "confidence": None,
            },
        )
        self.assertEqual(
            (b["relevance"], b["covers"], b["evidence"], b["completeness"], b["novelty"]),
            (
                0.3333,
                ["glucose sensors"],
                0.5,
                {"filled": 2, "of": 5},
                {"new_unit": False, "adds": []},
            ),
        )
        self.assertEqual(
            (c["relevance"], c["covers"], c["evidence"], c["completeness"], c["novelty"]),
            (
                0.6667,
                ["glucose sensors", "children"],
                0.625,
                {"filled": 2, "of": 5},
                {"new_unit": True, "adds": ["children"]},
            ),
        )

    def test_passage_edge_at_299_and_301_characters(self) -> None:
        for gap, expected in ((299, 1.0), (301, 0.5)):
            with self.subTest(gap=gap):
                url = "https://edge.test/p"
                text = "Ada Example" + " " + "." * (gap - 2) + " " + "glucose sensors"
                pages = {url: {"unit": "Invented", "text": text}}
                start = text.index("glucose sensors")
                evidence = {
                    "page_url": url,
                    "page_sha256": SHA,
                    "span": "glucose sensors",
                    "start": start,
                }
                name = {
                    "value": "Ada Example",
                    "method": "selector",
                    "evidence": {
                        "page_url": url,
                        "page_sha256": SHA,
                        "span": "Ada Example",
                        "start": 0,
                    },
                }
                prof = profile(
                    "person-edge",
                    "person",
                    name,
                    url,
                    expertise=[
                        {"value": "glucose sensors", "method": "selector", "evidence": evidence}
                    ],
                )
                response = worked_example() | {"results": [result(1, prof)]}
                metrics = with_metrics(response, [GLUCOSE], pages.get)["results"][0]["metrics"]
                self.assertEqual(metrics["evidence"], expected)

    def test_display_only_order_and_input_unchanged(self) -> None:
        response = worked_example()
        before = copy.deepcopy(response)
        after = with_metrics(response, TOPICS, PAGES.get)
        self.assertEqual(response, before)
        self.assertEqual(
            [(r["rank"], r["profile"]["id"]) for r in after["results"]],
            [(r["rank"], r["profile"]["id"]) for r in before["results"]],
        )
        self.assertEqual(
            [{k: v for k, v in r.items() if k != "metrics"} for r in after["results"]],
            before["results"],
        )

    def test_given_order_is_kept_and_novelty_follows_rank(self) -> None:
        response = worked_example()
        shuffled = response | {"results": list(reversed(response["results"]))}
        after = with_metrics(shuffled, TOPICS, PAGES.get)["results"]
        self.assertEqual([r["rank"] for r in after], [3, 2, 1])
        self.assertEqual(
            [r["metrics"]["novelty"]["adds"] for r in after],
            [["children"], [], ["glucose sensors", "wearables"]],
        )

    def test_abstained_response_gets_no_metrics(self) -> None:
        abstained = worked_example() | {"abstained": True, "results": []}
        self.assertEqual(with_metrics(abstained, TOPICS, PAGES.get), abstained)

    def test_no_topics_and_missing_pages_give_none_not_zero(self) -> None:
        metrics = with_metrics(worked_example(), [], PAGES.get)["results"][0]["metrics"]
        self.assertEqual((metrics["relevance"], metrics["evidence"]), (None, None))
        no_pages = with_metrics(worked_example(), TOPICS, lambda url: None)["results"][0]["metrics"]
        self.assertEqual((no_pages["relevance"], no_pages["evidence"]), (0.6667, None))

    def test_output_validates_against_the_result_contract(self) -> None:
        resources = [
            (p.name, Resource.from_contents(json.loads(p.read_text())))
            for p in CONTRACTS.glob("*.schema.json")
        ]
        registry = Registry().with_resources(resources)
        validator = Draft202012Validator(registry.contents("result.schema.json"), registry=registry)
        errors = [
            e.message
            for e in validator.iter_errors(with_metrics(worked_example(), TOPICS, PAGES.get))
        ]
        self.assertEqual(errors, [])


class TopicsTest(unittest.TestCase):
    def test_query_words_minus_framing_words(self) -> None:
        topics = query_topics("Who works on glucose sensors for children in Bern?")
        self.assertEqual([t.label for t in topics], ["glucose", "sensors", "children"])

    def test_expansions_add_wordings_but_never_topics(self) -> None:
        topics = query_topics(
            "glucose sensors for kids", {"glucose sensors": ["CGM"], "dragons": ["fire"]}
        )
        self.assertEqual(topics, [Topic("glucose sensors", ("glucose sensors", "CGM"))])


if __name__ == "__main__":
    unittest.main()

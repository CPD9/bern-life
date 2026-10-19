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
    "https://dcb.test/projects/counter": {
        "unit": "Invented Diabetes Unit",
        "text": "Carb Counter estimates carbohydrates from meal photos."
        + FILLER
        + "Project team: Emil Example",
    },
    "https://artorg.test/team/ben": {
        "unit": "Invented Engineering Unit",
        "text": "Ben Example\nPhD student, sweat patches for glucose\nCara Example\nPostdoc",
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


def result_validator() -> Draft202012Validator:
    resources = [
        (p.name, Resource.from_contents(json.loads(p.read_text())))
        for p in CONTRACTS.glob("*.schema.json")
    ]
    registry = Registry().with_resources(resources)
    return Draft202012Validator(registry.contents("result.schema.json"), registry=registry)


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
        errors = [
            e.message
            for e in result_validator().iter_errors(
                with_metrics(worked_example(), TOPICS, PAGES.get)
            )
        ]
        self.assertEqual(errors, [])


COUNTER, BEN = "https://dcb.test/projects/counter", "https://artorg.test/team/ben"
FETCHED = "2026-10-18T12:00:00Z"
CARBS = Topic("carbohydrates", ("carbohydrates",))
PHOTOS = Topic("meal photos", ("meal photos",))
PATCHES = Topic("sweat patches", ("sweat patches",))


def through_project() -> dict:
    """Emil has only a name claim. The project's claim says both topics; his name is 400
    characters below it on the project page, so the evidence is 0.5."""
    emil = profile("person-emil", "person", claim(COUNTER, "Emil Example"), COUNTER)
    via = {
        "kind": "works_on",
        "span": "Project team: Emil Example",
        "page_url": COUNTER,
        "page_sha256": SHA,
        "start": PAGES[COUNTER]["text"].index("Project team"),
        "fetched_at": FETCHED,
        "related_profile_id": "project-counter",
        "related_name": "Carb Counter",
        "related_claims": [
            claim(
                COUNTER,
                "estimates carbohydrates from meal photos",
                "carbohydrates from meal photos",
            )
        ],
    }
    return result(1, emil) | {"via": via}


def through_passage() -> dict:
    """Ben has only a name claim; the passage next to his name says the topic."""
    ben = profile("person-ben", "person", claim(BEN, "Ben Example"), BEN)
    passage = {
        "kind": "own_page",
        "span": "Ben Example\nPhD student, sweat patches",
        "page_url": BEN,
        "page_sha256": SHA,
        "start": 0,
        "fetched_at": FETCHED,
    }
    return result(1, ben) | {"passage": passage}


class CoverageTest(unittest.TestCase):
    """A topic is covered by the words of one of its wordings in any form, found in a claim, in
    the claim's enrichment terms, in a claim of the result's project or in the passage on its
    page; the evidence comes from where that sentence sits on its page."""

    def metrics_of(self, item: dict, topics: list[Topic], enrichment: dict | None = None) -> dict:
        response = worked_example() | {"results": [item]}
        return with_metrics(response, topics, PAGES.get, enrichment)["results"][0]["metrics"]

    def test_a_word_form_covers_the_topic_across_languages(self) -> None:
        lab = worked_example()["results"][2]
        asked_in_german = Topic("Glukosesensoren", ("Glukosesensoren",))
        metrics = self.metrics_of(lab, [asked_in_german, PATCHES])
        self.assertEqual(
            (metrics["relevance"], metrics["covers"], metrics["missing"], metrics["evidence"]),
            (0.5, ["Glukosesensoren"], ["sweat patches"], 1.0),
        )

    def test_a_wording_counts_only_with_all_its_words(self) -> None:
        ada = worked_example()["results"][0]
        pressure = Topic("pressure sensors", ("pressure sensors",))
        self.assertEqual(self.metrics_of(ada, [pressure])["covers"], [])

    def test_an_enrichment_term_of_a_claim_covers_the_topic(self) -> None:
        bea = worked_example()["results"][1]
        glucose = Topic("glucose", ("glucose",))
        without = self.metrics_of(bea, [glucose])
        with_term = self.metrics_of(bea, [glucose], {"CGM data quality": ["glucose monitoring"]})
        self.assertEqual((without["covers"], without["evidence"]), ([], None))
        self.assertEqual((with_term["covers"], with_term["evidence"]), (["glucose"], 0.5))

    def test_a_result_shown_through_a_project_is_covered_by_the_project_claim(self) -> None:
        metrics = self.metrics_of(through_project(), [CARBS, PHOTOS, GLUCOSE])
        self.assertEqual(
            metrics,
            {
                "relevance": 0.6667,
                "covers": ["carbohydrates", "meal photos"],
                "missing": ["glucose sensors"],
                "evidence": 0.5,
                "completeness": {"filled": 0, "of": 5},
                "novelty": {"new_unit": True, "adds": ["carbohydrates", "meal photos"]},
                "confidence": None,
            },
        )

    def test_a_result_shown_through_a_passage_is_covered_by_the_passage(self) -> None:
        metrics = self.metrics_of(through_passage(), [PATCHES, GLUCOSE])
        self.assertEqual(
            (metrics["relevance"], metrics["covers"], metrics["missing"], metrics["evidence"]),
            (0.5, ["sweat patches"], ["glucose sensors"], 1.0),
        )

    def test_results_shown_through_a_project_or_passage_validate_against_the_contract(self) -> None:
        response = worked_example() | {
            "results": [through_project(), through_passage() | {"rank": 2}]
        }
        errors = [
            e.message
            for e in result_validator().iter_errors(with_metrics(response, TOPICS, PAGES.get))
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

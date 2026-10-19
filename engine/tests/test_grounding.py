import unittest
from typing import Any

from bernlife.explain import claim_at
from bernlife.grounding import Grounding, ground
from search_fakes import EXAMPLE_UNIT, PROFILES, RELATIONS, claim, page, profile

CLEO, ADA, BEN, DORA, PATCH, EMIL, CARB = PROFILES
FINN_PAGE = page(
    "https://www.example-institute.test/team/finn-fiktiv",
    "example",
    EXAMPLE_UNIT,
    "Finn Fiktiv - Example Institute",
    "Finn Fiktiv\nSenior Scientist, Applied Sciences Unit\nResearch: insulin pumps.",
)
FINN = profile(
    "person-example-finn-fiktiv",
    FINN_PAGE,
    "Finn Fiktiv",
    role=[claim(FINN_PAGE, "Senior Scientist")],
    unit=[claim(FINN_PAGE, "Applied Sciences Unit")],
)
LIA_PAGE = page(
    "https://www.example-institute.test/team/lia-van-beispiel",
    "example",
    EXAMPLE_UNIT,
    "Lia van Beispiel - Example Institute",
    "Prof. Dr. Lia van Beispiel\nResearch: insulin pumps.",
)
LIA = profile("person-example-lia-van-beispiel", LIA_PAGE, "Lia van Beispiel")


def shown(item: dict[str, Any], *cites: str, via: dict[str, Any] | None = None) -> dict[str, Any]:
    """A result as search returns it, its reason citing `cites` (the name when none)."""
    pointers = list(cites) or ["/name"]
    text = "; ".join(claim_at(item, pointer)["value"] for pointer in pointers)
    result = {"profile": item, "reason": {"text": text, "cites": pointers}}
    return result | {"via": via} if via else result


def response(query: str, *items: dict[str, Any]) -> dict[str, Any]:
    results = [
        {"rank": rank, **item, "score": {"fused": 0.03, "lexical_rank": rank, "vector_rank": rank}}
        for rank, item in enumerate(items, 1)
    ]
    return {
        "query": query,
        "mode": "mock",
        "abstained": not results,
        "abstain_reason": None if results else "no_verifiable_source",
        "expanded_terms": [],
        "results": results,
        "versions": {"engine": "0.2.0", "snapshot": "fixture", "prompts": "none"},
    }


def through_carb_counter() -> dict[str, Any]:
    relation = RELATIONS[1]
    return {
        "kind": "works_on",
        "span": relation["span"],
        "page_url": relation["page_url"],
        "page_sha256": relation["page_sha256"],
        "start": relation["start"],
        "related_profile_id": CARB["id"],
        "related_name": "Carb Counter",
        "related_claims": CARB["fields"]["expertise"],
    }


GLUCOSE = response(
    "glucose sensors", shown(CLEO, "/fields/expertise/0"), shown(ADA, "/fields/expertise/0")
)
ADA_ONLY = Grounding((("person-example-ada-muster", "Ada Muster"),), ())


class GroundTest(unittest.TestCase):
    def test_a_result_person_is_a_mention(self):
        reply = "Ada Muster leads the GlucoPatch sensor project. I lit up her unit on the map."
        self.assertEqual(ground(reply, [GLUCOSE]), ADA_ONLY)
        self.assertTrue(ADA_ONLY.holds)

    def test_a_person_not_among_the_results_fails(self):
        grounding = ground("Ada Muster works with Hugo Brandtner on sensors.", [GLUCOSE])
        self.assertEqual(grounding, Grounding(ADA_ONLY.mentions, ("Hugo Brandtner",)))
        self.assertFalse(grounding.holds)
        self.assertEqual(
            ground("Both Ada Muster and Ben Beispiel work on GlucoPatch.", [GLUCOSE]).unknown,
            ("Ben Beispiel",),
        )

    def test_words_of_result_names_do_not_make_another_person(self):
        for reply, unknown in (
            ("Ada Beispiel works on glucose.", "Ada Beispiel"),
            ("Ada Muster-Beispiel works on glucose.", "Ada Muster-Beispiel"),
            ("Cleo Muster works on glucose.", "Cleo Muster"),
        ):
            with self.subTest(reply=reply):
                self.assertEqual(ground(reply, [GLUCOSE]), Grounding((), (unknown,)))

    def test_a_titled_name_must_be_part_of_a_result_persons_name(self):
        self.assertEqual(ground("Prof. Muster works on glucose.", [GLUCOSE]), ADA_ONLY)
        self.assertEqual(
            ground("Dr. Hugo works with Ada Muster’s team.", [GLUCOSE]),
            Grounding(ADA_ONLY.mentions, ("hugo",)),
        )

    def test_sentence_openers_places_and_organisations_are_not_people(self):
        reply = (
            "In Bern, the Demo Centre and the Sensor Lab work with Ada Muster. "
            "Both Ada Muster and I agree. At the University of Bern, glucose matters."
        )
        self.assertEqual(ground(reply, [GLUCOSE]), ADA_ONLY)

    def test_a_result_project_or_a_claim_value_with_capitals_is_no_stranger(self):
        results = response(
            "insulin",
            shown(EMIL, via=through_carb_counter()),
            shown(FINN, "/fields/role/0"),
        )
        reply = (
            "Emil Exempel works on Carb Counter. Finn Fiktiv is a Senior Scientist in the "
            "Applied Sciences Unit."
        )
        self.assertEqual(
            ground(reply, [results]),
            Grounding(
                (
                    ("person-demo-emil-exempel", "Emil Exempel"),
                    ("person-example-finn-fiktiv", "Finn Fiktiv"),
                ),
                (),
            ),
        )
        self.assertEqual(
            ground("Finn Fiktiv works with Senior Partner.", [results]).unknown,
            ("Senior Partner",),
        )

    def test_mentions_follow_the_results_and_names_keep_their_particles(self):
        results = response("insulin", shown(LIA), shown(ADA, "/fields/expertise/0"))
        self.assertEqual(
            ground("Ada Muster and Prof. Lia van Beispiel work on insulin.", [results]),
            Grounding(
                (
                    ("person-example-lia-van-beispiel", "Lia van Beispiel"),
                    ("person-example-ada-muster", "Ada Muster"),
                ),
                (),
            ),
        )

    def test_no_results_ground_no_names(self):
        self.assertEqual(ground("Ada Muster works on glucose.", []), Grounding((), ("Ada Muster",)))
        self.assertEqual(ground("I found no verifiable source for that.", []), Grounding((), ()))


if __name__ == "__main__":
    unittest.main()

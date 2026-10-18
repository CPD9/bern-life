import unittest

from evaluator.score import score_all
from evaluator.summary import by_slice, decisions, variant_agreement
from records import gold, profile, response, result

ADA = ("Ada Muster", "https://www.example.test/team/ada")
LAB = ("Sensor Lab", "https://www.example.test/labs/sensor")
BRUNO = ("Bruno Beispiel", "https://www.example.test/team/bruno")


def three_queries():
    """q100: Ada (name, rank 2) and the lab (name, rank 3) → recall 1, rr 1/2.
    q100b: Ada by URL only (rank 1), lab missed → recall 1/2, rr 1.
    q200: nothing → recall 0, rr 0. Pooled: recall 0.5, MRR 0.5."""
    queries = [
        gold("q100", people=[ADA], units=[LAB]),
        gold("q100b", variant="synonym", people=[ADA], units=[LAB], base="q100"),
        gold("q200", people=[BRUNO]),
    ]
    other_lab = profile("unit-other", "unit", "Other Lab", "https://www.example.test/labs/other")
    ada = profile(
        "person-ada", "person", "Prof. Dr. Ada Muster", "https://www.example.test/people/a"
    )
    lab = profile("unit-sensor", "unit", "Sensor Lab", "https://www.example.test/about")
    by_url = profile("person-else", "person", "Someone Else", "https://www.example.test/team/ada/")
    carla = profile(
        "person-carla", "person", "Carla Exempel", "https://www.example.test/team/carla"
    )
    responses = {
        "q100": response([result(1, other_lab), result(2, ada), result(3, lab)]),
        "q100b": response([result(1, by_url)]),
        "q200": response([result(1, carla)]),
    }
    return queries, responses


class ScoreTest(unittest.TestCase):
    def test_exact_recall_and_reciprocal_rank(self) -> None:
        queries, responses = three_queries()
        results = score_all(queries, responses, None, None)
        self.assertEqual([r.recall for r in results], [1.0, 0.5, 0.0])
        self.assertEqual([r.reciprocal_rank for r in results], [0.5, 1.0, 0.0])
        self.assertEqual([r.url_only_hits for r in results], [0, 1, 0])
        pooled = by_slice(results)["pooled"]
        self.assertEqual((pooled["recall_at_10"]["value"], pooled["mrr"]["value"]), (0.5, 0.5))
        self.assertEqual(variant_agreement(results)["synonym"]["jaccard_mean"], 0.0)

    def test_only_the_top_ten_count(self) -> None:
        filler = [
            result(
                rank,
                profile(f"person-{rank}", "person", f"Filler {rank}", f"https://f.test/{rank}"),
            )
            for rank in range(1, 11)
        ]
        late = result(
            11, profile("person-ada", "person", "Ada Muster", "https://www.example.test/a")
        )
        results = score_all(
            [gold("q100", people=[ADA])], {"q100": response(filler + [late])}, None, None
        )
        self.assertEqual((results[0].recall, results[0].reciprocal_rank), (0.0, 0.0))

    def test_invented_query_abstaining_is_right_and_answering_is_wrong(self) -> None:
        queries = [
            gold("q300", variant="invented", abstain=True),
            gold("q301", variant="invented", abstain=True),
        ]
        stranger = profile("person-x", "person", "Invented Stranger", "https://www.example.test/x")
        responses = {"q300": response([], abstained=True), "q301": response([result(1, stranger)])}
        results = score_all(queries, responses, None, None)
        self.assertEqual([r.abstained for r in results], [True, False])
        rate = by_slice(results)["pooled"]["invented_abstained"]
        self.assertEqual((rate["k"], rate["n"]), (1, 2))
        self.assertEqual(
            decisions(by_slice(results)["pooled"], results)["abstention"]["status"], "not met"
        )

    def test_snapshot_checks_are_not_computed_without_the_snapshot(self) -> None:
        queries, responses = three_queries()
        pooled = by_slice(score_all(queries, responses, None, None))["pooled"]
        self.assertEqual((pooled["traceable_claims"], pooled["invented_entities"]), (None, None))


if __name__ == "__main__":
    unittest.main()

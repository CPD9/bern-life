import unittest

from bernlife.predict_command import predict, summary

GOLD = [
    {"id": "q002", "query": "second", "sources": ["dcb"]},
    {"id": "q001", "query": "first", "sources": ["unibe"]},
    {"id": "q001b", "query": "variant", "sources": ["unibe"]},
]


class PredictTest(unittest.TestCase):
    def test_one_line_per_gold_id_sorted_with_the_query_text_only(self):
        asked = []

        def run(query: str) -> dict:
            asked.append(query)
            return {"query": query, "abstained": query == "second"}

        lines, latencies = predict(GOLD, run)
        self.assertEqual([line["id"] for line in lines], ["q001", "q001b", "q002"])
        self.assertEqual(asked, ["first", "variant", "second"])
        self.assertEqual(
            lines[2], {"id": "q002", "response": {"query": "second", "abstained": True}}
        )
        self.assertEqual(len(latencies), 3)

    def test_summary_reports_abstentions_and_latency_percentiles(self):
        lines = [{"response": {"abstained": n == 0}} for n in range(20)]
        latencies = [float(n) for n in range(1, 21)]
        self.assertEqual(
            summary(lines, latencies),
            "predict: 20 queries, 1 abstained; latency ms p50 10, p95 19, max 20",
        )


if __name__ == "__main__":
    unittest.main()

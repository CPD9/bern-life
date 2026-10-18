import json
import tempfile
import unittest
from pathlib import Path

from bernlife.chunks import Chunk, vector_key
from bernlife.embed import Embedder
from bernlife.embed_command import vector_rows
from search_fakes import write_bundle


class CountingEncoder:
    def __init__(self):
        self.seen: list[list[str]] = []

    def __call__(self, texts: list[str]) -> list[list[float]]:
        self.seen.append(texts)
        return [[float(len(text)), 0.1234567891] for text in texts]


def chunk(chunk_id: str, text: str) -> Chunk:
    return Chunk(chunk_id, "chunk", None, "https://x.test/", "example", text)


class EmbedderTest(unittest.TestCase):
    def test_queries_and_passages_get_their_e5_prefixes(self):
        encoder = CountingEncoder()
        embedder = Embedder(encoder)
        embedder.query("glucose")
        embedder.passages(["a", "b"])
        self.assertEqual(encoder.seen, [["query: glucose"], ["passage: a", "passage: b"]])

    def test_passages_are_encoded_in_batches_of_32(self):
        encoder = CountingEncoder()
        Embedder(encoder).passages([str(n) for n in range(40)])
        self.assertEqual([len(batch) for batch in encoder.seen], [32, 8])


class VectorRowsTest(unittest.TestCase):
    def test_only_texts_without_a_stored_vector_are_encoded_and_values_are_rounded(self):
        encoder = CountingEncoder()
        stored = {vector_key("old"): [0.5, 0.5]}
        chunks = [chunk("c1", "old"), chunk("c2", "new"), chunk("c3", "new")]
        rows, encoded = vector_rows(chunks, stored, Embedder(encoder))
        self.assertEqual(encoder.seen, [["passage: new"]])
        self.assertEqual(encoded, 1)
        self.assertEqual(
            rows,
            [
                {"id": vector_key("old"), "kind": "chunk", "vector": [0.5, 0.5]},
                {"id": vector_key("new"), "kind": "chunk", "vector": [12.0, 0.123457]},
            ],
        )

    def test_the_file_is_sorted_by_id_and_drops_vectors_no_chunk_uses(self):
        folder = Path(tempfile.mkdtemp())
        (folder / "vectors.jsonl").write_text('{"id": "unused", "kind": "chunk", "vector": [1]}\n')
        write_bundle(folder)
        ids = [
            json.loads(line)["id"] for line in (folder / "vectors.jsonl").read_text().splitlines()
        ]
        self.assertEqual(ids, sorted(ids))
        self.assertNotIn("unused", ids)
        self.assertEqual(len(ids), 9)


if __name__ == "__main__":
    unittest.main()

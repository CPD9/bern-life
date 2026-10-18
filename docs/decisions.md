# Decisions

Newest first. Each entry: date, decision, why, who.

## 2026-10-18 — Base decisions (Peter, conductor)
- **Postgres 17 + pgvector, schema in Prisma (`db/`).** Scalability matters and work continues after
  the hackathon; the world layer will need users and claims in the same database. The Python engine
  uses raw SQL against the Prisma-made tables, so there is one schema. Search is one SQL statement
  (full-text rank + HNSW cosine, fused with reciprocal rank fusion), filters inside the index scan.
- **Embeddings: `intfloat/multilingual-e5-small` via fastembed/ONNX on CPU.** Lay-term and
  cross-language matching without torch or a GPU; MIT licence.
- **Snapshot bundle out of git.** Pages, model cache and vectors ship as a SHA-pinned release asset.
  Git history cannot forget a person (nDSG deletion path), and the pages belong to the institutions.
  The repo keeps code, configs, the gold set and short evidence spans.
- **No emails or phone numbers stored.** Data minimisation; the source page link is the contact path.
- **Models:** CSCS API (Swiss National Supercomputing Centre) for the demo and enrichment; Peter's
  RunPod vLLM (not Swiss) only for smoke tests. The same vLLM serve scripts run Apertus on local or
  air-gapped hardware, which is the sovereignty story; replay needs no model at all.
- **Brief upload is the demo story.** From Peter's "Bern Social Network" diagram: a company sends a
  project description, Apertus reads the needs (each tied to a sentence of the brief), the same
  search finds matched experts with evidence. The gold set still uses short queries, as the case
  asks.
- **Seeds:** the 22 hosts Peter supplied from the case inventory: 20 UniBE institutes and platforms,
  ARTORG, Diabetes Center Berne.

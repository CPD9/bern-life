# Bern Life

Bern Life is the Research & Expertise Navigator for Bern: ask in your own words and get the people,
units, projects and facilities of the University of Bern, the ARTORG Center and Diabetes Center
Berne, each with a link to the public page it comes from. You use it inside a small life-sim of
Bern, built on Apertus v1.5, and every fact it shows about anyone is a sentence copied word for
word from that page and checked in code.

## Try it

You need Docker with Compose, `make` and Python 3.12. `make fetch` uses the `gh` command when it
is installed (needed while the repository is private) and a plain download otherwise.

```bash
make fetch    # download the pinned snapshot bundle, check its sha256 and every file in it
make run      # Postgres, the engine and the web app, replaying the bundle: no GPU, no model key
```

Open **http://127.0.0.1:3000**. `make stop` stops it again. The search without the world is at
http://127.0.0.1:3000/navigator.

**A 60-second tour**

1. **Land on the map.** A drawn Bern with the Aare, the old town and the bridges. Institutes stand
   at their own street addresses. There are no map tiles and nothing loads from elsewhere.
2. **Ask.** Tap **Phone**, then **Ask**, and paste
   `Is anyone in Bern building an alarm that detects low blood sugar at night in elderly people in care homes?`
   The answer lists the extra search terms Apertus added (labelled as search terms, never as
   facts) and up to 20 results. Then try
   `Results of the ALPENHITZE cohort study led by Prof. Beat Zurbriggen at ISPM`: the professor and
   the study are invented, so it says that no verifiable source exists instead of guessing.
3. **Open the evidence.** Tap any role, unit or expertise on a result card. The sentence from the
   page opens with its link and the date it was fetched. "Why it matches" cites only those claims.
4. **Join.** Joining is by invite. Make a code with
   `cd web && bun install && DATABASE_URL=postgresql://bernlife:bernlife@127.0.0.1:5433/bernlife bun run invite:create`
   (needs [Bun](https://bun.sh)), then choose **Join Bern Life**.
5. **Onboarding.** Five short steps: who you are in Bern, your look (you are a person), what
   brings you here, who sees what, and your first agent: a bear called Lumi, which you can rename.
6. **Your office.** Onboarding ends in your office, with you on the rug and Lumi by the desk.
7. **The desktop.** Click the desk to use the computer: the Navigator, Agents, Messages and
   Reports open as windows. Notifications stay inside the app.
8. **Lumi.** In Agents, Lumi's skills (search, project brief, match report) each have a Try button.
   A loop reruns a saved search and tells you what changed, with source links.

Questions that are not recorded in the bundle's model cache still get an answer: plain search
over the stored pages, and the app says so. Only `make live` with a model endpoint in `.env`
calls Apertus.

## Against the case

Measured on the frozen gold set (48 questions in English, German and French, written from public
pages before search existed) with the snapshot bundle `bundle-20261019-1`. The numbers are the
evaluator's output: after `pip install -e engine`, `make fetch && make eval` prints the same
table and writes `eval/out/metrics.json`. Recall@10 and MRR intervals are a bootstrap over base
questions (2,000 draws, seed 1); proportions have Wilson intervals. Metrics and decision rules
were fixed in advance in [`eval/PREREGISTRATION.md`](eval/PREREGISTRATION.md).

| Case success criterion | Where it shows | Measured (95% interval) |
|---|---|---|
| 1. Finds the right people: ≥ 80% of expected experts and units in the top 10 | The result list in Ask | recall@10 **0.36** [0.20, 0.53] against the case's **0.80**: **not met**. MRR 0.43 [0.26, 0.59]. |
| 2. Different wording finds the same experts | "Also searched for" on every answer: synonyms, lay terms, translations, acronyms | recall@10 on the site's own wording 0.39 [0.21, 0.57]; synonyms 0.82 [0.67, 1.00] (3 questions); lay terms 0.33 [0.00, 1.00] (3); translations 0.24 [0.08, 0.43] (12). By language: en 0.51 [0.32, 0.70], de 0.18 [0.05, 0.41], fr 0.12 [0.00, 0.25]. |
| 3. Every result traceable, nothing invented | The evidence panel behind every claim: verbatim sentence, source link, fetch date | Claims whose sentence is verbatim on their stored page: 4,823 / 4,823, **100%** [1.00, 1.00]. Results not in the snapshot (invented entities): **0**. |
| 3. (ethics) Says so when no source exists | "No verifiable source" instead of results | Invented questions abstained **8 / 10** [0.49, 0.94], below the pre-registered 9 / 10. False abstentions **0 / 38** [0.00, 0.09]. |
| 4. Structured results | Result card fields: person, role, unit, expertise, projects, infrastructure and services, why it matches, source link | Mean share of the 8 fields filled: 0.61 over 371 shown results. No interval: the pre-registered human check of what each page could fill is still to do. |
| 5. Covers UniBE, ARTORG and Diabetes Center Berne | Places on the map; the source on every card | recall@10 UniBE 0.18 [0.05, 0.31], ARTORG 0.44 [0.17, 0.76], DCB 0.58 [0.32, 0.88]. Share of top-10 slots 0.60 / 0.23 / 0.17 against share of profiles 0.79 / 0.13 / 0.07. |
| 6. Easy to extend | One JSON file in [`sources/`](sources/) and one command ([playbook](docs/playbooks/add-a-source.md)) | Not a measured number. `python -m bernlife crawl --source <id>` crawls a new file, and only that source's records are replaced. |

The evaluator is separate code from the search ([`eval/src/evaluator/`](eval/src/evaluator/)) and
imports nothing from the engine. How the numbers on each result are computed is in
[`docs/metrics.md`](docs/metrics.md).

## How it works

```
public pages ─► crawl ─► extract with evidence ─► verify in code ─► enrich ─► hybrid search ─► explain from cited claims
```

<img src="docs/assets/explain-page-to-profile.svg" alt="From page to profile: a sentence on a page passes the verifier and becomes a claim; a model proposal that is not on the page is dropped" width="800">

1. **Crawl.** Each institution is a JSON file in `sources/` with its hosts, seeds and allowed
   paths. The crawler reads robots.txt first, waits between requests and stores every page with
   its URL, fetch date and sha256. E-mail addresses and phone numbers are removed before the text
   is stored.
2. **Extract with evidence.** Selectors read names, roles and units from the page layout. Apertus
   70B proposes further values, each with the sentence it came from, and sees the page only as
   data.
3. **Verify in code.** A proposal is kept only if its sentence occurs in the stored page text
   exactly. The stored sentence is always cut from the page, never taken from the model. A
   database trigger checks the same again on load, and the evaluator checks it a third time
   ([extraction](docs/extraction.md)).
4. **Enrich.** Apertus adds retrieval terms to each expertise value (synonyms, lay terms,
   translations, acronyms). They help search find pages and are never shown as facts.
5. **Hybrid search.** Full-text (BM25-weighted) and vector search (multilingual-e5-small, on CPU)
   run in one Postgres statement and are fused by reciprocal rank. A result is shown only if one
   of its own cited claims, or a project it works on, matches the question. At most 4 people of
   one unit fill the top 10, and there is no popularity signal
   ([search](docs/search.md)).
6. **Explain from cited claims only.** For the top 5, Apertus writes "why it matches" from the
   question, the name and the cited claims, nothing else. Code rejects the text if it cites a
   claim it was not given or capitalises a word found in neither those claims nor the name; the
   plain reason listing the claims stays instead.

<img src="docs/assets/explain-ask.svg" alt="Ask in your words: the question becomes search terms, full-text and meaning search merge into one ranking, and each result keeps its evidence" width="800">

<img src="docs/assets/explain-brief.svg" alt="A project brief: a PDF becomes needs tied to their sentences, matched experts with coverage and gaps" width="800">

A company can also upload a project PDF. Each need keeps the sentence of the PDF it came from, and
each matched expert shows which needs their cited claims cover. The PDF is read once and not kept.

## Sovereignty

- **Apertus only, through Swiss endpoints.** Every model role runs on Apertus v1.5 70B at CSCS,
  the Swiss National Supercomputing Centre ([`infra/cscs.md`](infra/cscs.md)). Models are reached
  only through the endpoints set in `.env`, and every call goes through the cache.
- **Replay with no model.** Every model call goes through a cache that ships in the snapshot
  bundle, so `make run` answers without a GPU, a key or a network connection to any model.
- **Your own hardware.** The vLLM scripts in [`infra/runpod/`](infra/runpod/README.md) serve
  Apertus 70B (FP8) or 8B at pinned revisions on any machine with suitable GPUs, local or
  air-gapped, behind a loopback tunnel.
- **Self-hosted.** Postgres with pgvector, the engine and the web app run in Docker. The embedding
  model is downloaded once on the first start, at a pinned revision checked by sha256. The map is
  drawn in three.js without tiles, and the app loads no fonts or scripts from elsewhere. A hosted
  copy runs on Exoscale in Geneva, invite-only ([`infra/exoscale.md`](infra/exoscale.md)).

## Data protection

- **Public pages only**, from allow-listed hosts, respecting robots.txt and rate limits.
- **No e-mail addresses or phone numbers are stored.** The contact is the source page.
- **People from public pages are entries with sources, never avatars or characters** in the world.
- **The snapshot bundle never enters git.** It is a sha256-pinned release asset
  ([`bundle.lock`](bundle.lock)), so a page can be removed by publishing a new bundle.
- **Accounts are invite-only**, and a project PDF is read once and not kept.
- Source pages remain the institutions' property; results quote only short evidence sentences
  ([`NOTICE`](NOTICE), [`PROVENANCE.md`](PROVENANCE.md)).

## Limits and roadmap

- **Recall is below the case's bar:** 0.36 against 0.80. A candidate is shown only when a claim
  it cites shares a word with the question, so someone found only through a passage or a phrase in
  another language stays hidden rather than shown without a reason.
- **German and French questions find less** (de 0.18, fr 0.12) than English (0.51). There is no
  stemming, so word forms such as "Kohlenhydrate" and "Kohlenhydraten" do not match.
- **Two of ten invented questions still get results:** one asks about an invented project, and
  one uses a French title the premise check does not know.
- **UniBE is found least often** (0.18) of the three sources.
- Explanations are written in English only, and field completeness still needs its human check.
- Next: matching word forms and claims across languages, the human completeness labels, a
  calibrated confidence per result, and the funding, service and space sources already configured
  in `sources/` loaded into the next bundle.

## Team

- **Peter Dike**: engine, search and evaluation
- **Yaseen Mohamed**: backend, infrastructure and hosting
- **Nik Milcevs**: avatars, onboarding and the home

## Licence

Code under Apache-2.0 ([`LICENSE`](LICENSE)). Models: Apertus v1.5 (Swiss AI Initiative) and
multilingual-e5-small. The case text is in [`docs/case.md`](docs/case.md); to contribute, read
[`CONTRIBUTING.md`](CONTRIBUTING.md).

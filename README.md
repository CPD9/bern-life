# Bern Life

Bern Life finds the people in Bern who work on what you need, and shows you the sentence from
their own institution's page that proves it.

It is the Research & Expertise Navigator for Bern, built for the HackApertus case. Ask in your own
words and get the people, units, projects and facilities of the University of Bern, the ARTORG
Center and Diabetes Center Berne, each with a link to the public page it comes from. You use it
inside a small life-sim of Bern (a drawn, walkable model of the city). The language model behind it
is Apertus v1.5, the Swiss open model. Every fact it shows about anyone is a sentence copied word
for word from a public page and checked in code.

**What it does for you**

- **Ask in your own words.** "Blood sugar sensors" works as well as the medical term. Apertus adds
  search terms (synonyms, lay terms, translations), and they are shown as search terms, never as
  facts.
- **Every answer shows its proof.** Each role, unit or expertise on a result opens the sentence
  from the institution's own page, with the link and the date the page was read.
- **It says so when there is no proof.** A question with no page behind it gets "no verifiable
  source" instead of a guess.

<img src="docs/assets/screenshot-bern.png" alt="Bern Life: the drawn map of Bern with the phone's Ask app open" width="800">

## Try it in five minutes

You need Docker with Compose (it runs the app in containers, so nothing else is installed on your
machine), `make` and Python 3.12. `make fetch` uses the `gh` command when it is installed (needed
while the repository is private) and a plain download otherwise.

```bash
make fetch    # download the pinned snapshot bundle (the stored copy of the public pages), check its sha256 and every file in it
make run      # start Postgres, the engine and the web app, replaying the bundle: no GPU, no model key
```

Open **http://127.0.0.1:3000** and:

1. **Tap Phone, then Ask**, and tap one of the three example questions, or paste
   `Is anyone in Bern building an alarm that detects low blood sugar at night in elderly people in care homes?`
   The answer lists the extra search terms Apertus added (labelled as search terms, never as
   facts) and the results.
2. **Tap a role, unit or expertise on a result card.** The sentence from the page opens with its
   link and the date it was fetched.
3. **Tap Show on map.** The places that hold results light up. Open one to see its units and the
   matches found there.
4. **Walk the case.** The phone has one app per case criterion, numbered **1 People** to
   **7 Honest no**. Each says what the case asks, runs a recorded question with one tap, tells you
   what to look for, shows the number the evaluator measured for it, and **Next** takes you to
   the following one.

<img src="docs/assets/screenshot-phone.png" alt="The phone's home screen: the case, step by step, as seven numbered apps above the other apps" width="800">

Then paste `Results of the ALPENHITZE cohort study led by Prof. Beat Zurbriggen at ISPM`. The
professor and the study are invented, so the app says that no verifiable source exists instead of
guessing.

`make stop` stops it again. The search without the world is at http://127.0.0.1:3000/navigator,
and the office computer without the 3D room at http://127.0.0.1:3000/office. In a browser without
3D graphics (WebGL), the map and the office room give way to a short note, and Ask, the office desk
and every app still work.

## How to read what you see

**The chip on every answer** says where the help came from:

- **Live**: Apertus answered just now.
- **Replay**: Apertus's recorded answer for this exact question. The search itself still runs live
  over the stored pages; only Apertus's part, the search terms and the explanation, is played back
  from a recording that ships with the bundle.
- **Plain search**: your words only, no recorded Apertus terms. In replay, every question that was
  not recorded gets this, and the app says so.

**The evidence panel.** Tap any role, unit or expertise on a result card. The sentence from the
page opens with its link and the date it was fetched. "Why it matches" cites only those claims.
Every claim and every map address has a **Wrong or outdated?** note (see
[Corrections and removal](#corrections-and-removal)).

**The map.** A drawn Bern with the Aare, the old town and the bridges. Institutes stand at the
street address their own pages give (in their district when no page gives one), and so do places
for business in Bern such as the Bern Economic Development Agency, Innosuisse, Effinger coworking
and PROGR. There are no map tiles and nothing loads from elsewhere. **Show on map** lights the
places that hold results; open a place to see its units, each with its address and source page (or
its district, when its pages give no address), and the matches found there.

**"No verifiable source."** When no stored page supports an answer, the app says so instead of
inventing one. The same rule holds for Bärnli, your agent: a person it names must be among the
search results, a reply it cannot support is replaced by a summary of the cited claims, and with
nothing behind it Bärnli says it found no verifiable source.

Replay is the default. Questions recorded in the bundle's model cache get Apertus's search terms
and explanations; any other question still gets plain search over the stored pages, and the app
says so. A new project brief needs the model: replay has only the briefs recorded in the bundle,
and the app says so for any other. In replay Bärnli searches your message and summarises the cited
claims; its own recorded answers ship with the next bundle.

## Live Apertus

In the demo, Apertus is called live for every question. Start the app with `make live-run` in
place of `make run`, then sign in. It starts only when the model endpoint set in `.env` answers.
The model is called only for signed-in members under their limits, at most `LLM_CALL_BUDGET` calls
a day (unset: none). Everyone else is answered from the recordings.

## The world around the search

- **Join.** Joining is by invite. Make a code with
  `cd web && bun install && DATABASE_URL=postgresql://bernlife:bernlife@127.0.0.1:5433/bernlife bun run invite:create`
  (needs [Bun](https://bun.sh)), then choose **Join Bern Life**.
- **Onboarding.** Bärnli, your first agent, greets you. Five short steps follow: who you are in
  Bern, your look (players are people), what brings you here, who sees what, and your agent:
  Bärnli is a bear you can rename and restyle. A card then offers to choose where your office
  stands; each plot lists the nearest places with their sourced addresses.
- **Your office** is the **Home** tab. Sit at the desk to use the computer, nine apps (ten for the
  admin account): **Navigator** (the same search as Ask, and a project brief), **Agents** (Bärnli's
  skills, each with its evidence, and loops: saved searches you run again, whose new and dropped
  results reach the bell), **Reports** (match reports with their sources), **Messages** (to members
  who joined), **Library** (what you saved, and your documents with their trace), **Opportunities**
  (funding calls, services and spaces; an amount or deadline appears only inside the sentence it was
  read from), **Garage** (the Apertus models and the evaluator's numbers for this snapshot, as the
  engine serves them, and the skills with their evidence), **Sources** (the institutions crawled,
  and how to add one) and **Settings**; the admin account also has **Admin** (the engine's model
  calls per day against its budget, and the person profiles whose name reads like a company, each
  with its page to check). The door leads back to the map; the phone carries Ask, Messages, Agents,
  Opportunities, Library, Sources, Settings and the seven case steps.
- **Bärnli** floats beside you as the bear you made, and walks beside you on the map; either opens
  its chat. Bärnli searches with the engine's own tools and answers with the same source cards as
  Ask. An answer stays in the chat, with buttons to light its places on the map, open its card in
  Ask or make a match report (it opens in the desk's Reports window); nothing happens until you
  click.
- **The story.** A card offers **Start the story**, quests about moving a business to Bern that
  each walk through one part of the case and complete only when you actually do the step in the
  app, or **Explore freely**. Your badge opens the **You** sheet: profile, goals, skills, people
  and agents, with real content only.
- **Walk Bern.** Out of the office you stand at your office door (at the station before you
  settle), Bärnli beside you. Press **Walk** on the map: the arrows or W A S D walk you and the
  camera follows; a click on the ground or a bridge finds the way round the houses and over the
  bridges, and a click on a place's building or your office, or **Walk here** on a place, walks
  you to its door. At a place's door **Enter** opens its lobby; at your own door **Go home**
  takes you inside. The city's clock runs about 85 times faster than walking pace.

## Against the case

The table below is measured by a separate program (the evaluator) on a frozen set of questions,
and CI (the check that runs on every change) refuses a README whose numbers differ from what it
measured.

Measured by the evaluator on the frozen gold set: questions in English, German and French, written
from public pages before search existed, scored on the pinned snapshot bundle. The evaluator is
separate code from the search ([`eval/src/evaluator/`](eval/src/evaluator/)) and imports nothing
from the engine. Its metrics, intervals and decision rules were fixed in advance in
[`eval/PREREGISTRATION.md`](eval/PREREGISTRATION.md): recall@10 and MRR intervals are a bootstrap
over base questions, proportions have Wilson intervals. Every number in the table is written by
[`infra/readme_numbers.py`](infra/readme_numbers.py) from the evaluator's output (`make eval` needs
`jsonschema`, which `pip install -e engine` brings), and CI fails when the two differ.

<!-- numbers:start -->
<!-- Written by infra/readme_numbers.py from eval/out/metrics.json: change the script, not this block. -->

| What the case asks | Where it shows | Measured (95% interval) |
|---|---|---|
| 1. Finds the right people: ≥ 80% of expected experts and units in the top 10 | The result list in Ask | recall@10 **0.39** [0.24, 0.56] against the case's **0.80**: **not met**. MRR 0.45 [0.29, 0.60]. |
| 2. Different wording finds the same experts | "Also searched for" on every answer: synonyms, lay terms, translations, acronyms | recall@10 on the site's own wording 0.43 [0.27, 0.58] (14 questions); synonyms 0.82 [0.67, 1.00] (3); lay terms 0.42 [0.00, 1.00] (3); translations 0.27 [0.10, 0.46] (12). By language: en 0.55 [0.38, 0.73] (22), de 0.20 [0.05, 0.41] (11), fr 0.12 [0.00, 0.25] (5). Top-10 overlap with the site's wording (mean Jaccard): synonyms 0.31, lay terms 0.24, translations 0.24. |
| 3. Every result traceable, nothing invented | The evidence panel behind every claim: verbatim sentence, source link, fetch date | Claims whose sentence is verbatim on their stored page: 3,931 / 3,931, **100%** [99.9%, 100%]. Results not in the snapshot (invented entities): **0**. Pre-registered rule: **met**. |
| Ethics: says so when no reliable source exists | "No verifiable source" instead of results | Invented questions abstained **9 / 10** [0.60, 0.98]; the pre-registered rule asks ≥ 9 / 10, and at most 1 false abstention on the site's own wording, where there are **0**: **met**. False abstentions on all answerable questions **0 / 38** [0.00, 0.09]. |
| 4. Structured results | Result card fields: person, role, unit, expertise, projects, infrastructure and services, why it matches, source link | Mean share of the 8 fields filled: 0.58 over 372 shown results. Filled per field: person 372, role/affiliation 130, unit 162, expertise 233, projects 41, infrastructure/services 49, reason 372, source link 372. No interval: the pre-registered human check of what each page could fill is still to do. |
| 5. Covers UniBE, ARTORG and Diabetes Center Berne | Places on the map; the source on every card | recall@10 UniBE 0.27 [0.10, 0.45], ARTORG 0.44 [0.21, 0.70], DCB 0.56 [0.26, 0.88]. Share of top-10 slots 0.58 / 0.24 / 0.18 against share of profiles in the snapshot 0.76 / 0.13 / 0.07. |
| 6. Easy to extend | One JSON file in [`sources/`](sources/) and one command ([playbook](docs/playbooks/add-a-source.md)) | Not a measured number. `python -m bernlife crawl --source <id>` crawls a new file, and only that source's records are replaced. |

Snapshot `bundle-20261019-4`, 48 gold questions. To reproduce: `make fetch && make eval && python3 infra/readme_numbers.py`. CI fails when this block differs from the evaluator's output.
<!-- numbers:end -->

How the numbers on each result are computed is in [`docs/metrics.md`](docs/metrics.md). It also
has exploratory evaluator numbers this table leaves out, with the commands that compute them:
top-10 overlap across wordings of one need for criterion 2 (built on the case's glucose example),
exposure by unit size, and the two-person check of criterion 4.

## How it works

Public pages are read, each fact is pulled out with its sentence, checked in code, widened with
search terms, searched, and explained from the cited sentences only:

```
public pages ─► crawl ─► extract with evidence ─► verify in code ─► enrich ─► hybrid search ─► explain from cited claims
```

<img src="docs/assets/explain-page-to-profile.svg" alt="From page to profile: a sentence on a page passes the verifier and becomes a claim; a model proposal that is not on the page is dropped" width="800">

1. **Crawl (read the public pages).** Each institution is a JSON file (a small settings file) in
   `sources/` with its hosts (web addresses), seeds (start pages) and allowed paths. The crawler
   reads robots.txt first (the file where a site says what may be read), waits between requests
   and stores every page with its URL, fetch date and sha256 (a fingerprint that shows whether the
   page changed). E-mail addresses and phone numbers are removed before the text is stored.
2. **Extract with evidence (pull facts out, each with its sentence).** Selectors (rules tied to the
   page layout) read names, roles and units. Apertus 70B (the large Apertus model) proposes further
   values, each with the sentence it came from, and sees the page only as data, never as
   instructions.
3. **Verify in code (check every sentence against the page).** A proposal is kept only if its
   sentence occurs in the stored page text exactly. The stored sentence is always cut from the
   page, never taken from the model. A database trigger (a rule the database applies by itself)
   checks the same again on load, and the evaluator checks it a third time
   ([extraction](docs/extraction.md)).
4. **Enrich (add search terms).** Apertus adds retrieval terms to each expertise value: synonyms,
   lay terms, translations, acronyms. They help search find pages and are never shown as facts.
5. **Hybrid search (search by words and by meaning at once).** Full-text search (matching words,
   BM25-weighted) and vector search (matching meaning, with the multilingual-e5-small model on an
   ordinary processor, no GPU) run in one Postgres statement and are fused by reciprocal rank (the
   two rankings are combined into one). A result is shown only if one of its own cited claims, or
   a project it works on, matches the question. At most 4 people of one unit fill the top 10, and
   there is no popularity signal ([search](docs/search.md)).
6. **Explain from cited claims only.** For the top 5, Apertus writes "why it matches" from the
   question, the name and the cited claims, nothing else. Code rejects the text if it cites a
   claim it was not given or capitalises a word found in neither those claims nor the name; the
   plain reason listing the claims stays instead.

<img src="docs/assets/explain-ask.svg" alt="Ask in your words: the question is typed, Apertus adds search terms that are not facts, and each result card shows a sentence quoted from the institute's own page" width="800">

<img src="docs/assets/explain-brief.svg" alt="A company's brief: sentences of a PDF lift out as needs, each expert shows which needs they cover, partly cover or miss, and the gap is named" width="800">

A company can also upload a project PDF. Each need keeps the sentence of the PDF it came from, and
each matched expert shows which needs their cited claims cover. The PDF is read once and not kept.
Reading a new brief needs the model, so it works in a live run, not in replay.

## Sovereignty

- **Apertus only, through Swiss endpoints.** Every model role runs on Apertus v1.5 70B at CSCS,
  the Swiss National Supercomputing Centre ([`infra/cscs.md`](infra/cscs.md)). Models are reached
  only through the endpoints set in `.env`, and every call goes through the cache.
- **Replay with no model.** Every model call goes through a cache that ships in the snapshot
  bundle. So `make run` answers without a GPU, a key or a network connection to any model.
- **Your own hardware.** The vLLM scripts (a program that serves a model) in
  [`infra/runpod/`](infra/runpod/README.md) serve Apertus 70B (FP8) or 8B at pinned revisions on
  GPUs you control, behind a loopback tunnel (a connection that never leaves the machine). The
  bundle replays on a machine with no network at all. Both paths are in
  [`infra/sovereign.md`](infra/sovereign.md); they are documented, not yet rehearsed end to end.
- **Self-hosted.** Postgres with pgvector (the database), the engine and the web app run in Docker.
  The embedding model is downloaded once on the first start, at a pinned revision checked by
  sha256. The map is drawn in three.js without tiles, and the app loads no fonts or scripts from
  elsewhere. A hosted copy runs on Exoscale in Geneva, invite-only, with nightly backups and an
  uptime check (`python3 -m infra.check_hosted --watch`, [`infra/exoscale.md`](infra/exoscale.md)).

## Data protection

- **Public pages only**, from allow-listed hosts, respecting robots.txt and rate limits.
- **No e-mail addresses or phone numbers are stored.** The contact is the source page.
- **People from public pages are entries with sources, never avatars or characters** in the world.
- **The snapshot bundle never enters git.** It is a sha256-pinned release asset
  ([`bundle.lock`](bundle.lock)) that carries the pages, so that the replay demo, the hosted copy
  and the evaluation all run from the same snapshot. It grants no licence to reuse them. A page is
  removed on request by publishing a new bundle without it and reloading the hosted copy, whose
  nightly backups age out after 14 days ([`PROVENANCE.md`](PROVENANCE.md#the-snapshot-bundle)).
- **Accounts are invite-only**, and a project PDF is read once and not kept.
- **Nothing leaves the app on its own.** Notifications are in-app (the bell); the agent sends
  nothing outside the app without a click.
- Source pages remain their publishers' property; results quote only short evidence sentences
  ([`NOTICE`](NOTICE), [`PROVENANCE.md`](PROVENANCE.md)).

### Corrections and removal

Bern Life removes on request. The Swiss Federal Act on Data Protection (nDSG) gives the people
named the right to ask. Every claim is a sentence quoted from an institution's public page on the
date shown beside it. Every quote and map address in the app has a **Wrong or outdated?** note
that links to the app's own [`/corrections`](web/app/corrections/page.tsx) page, which says what
this section says. The note only explains, and nothing is sent from the app.

- **Wrong or outdated sentence:** the institution corrects its own page, and the change reaches
  Bern Life with the next snapshot bundle.
- **Wrong or outdated address:** the map's addresses are not in the bundle but in git, in
  [`web/features/world/places.json`](web/features/world/places.json) with page, date and sha256
  per row. One is corrected or removed by a commit to that file, and git history keeps the
  earlier value.
- **Removal:** write to [peter.dike@unibe.ch](mailto:peter.dike@unibe.ch) with the page link and
  the sentence; nothing else about you is needed. The `/corrections` page shows the address as a
  plain mail link that opens your own mail program; the app sends and keeps nothing. If you do
  not mind others reading the request, open an issue on this repository instead.
- **What happens:** the page is left out. Its path goes into `deny_paths` in its source's file in
  [`sources/`](sources/), and a new bundle is built without it and pinned. The earlier release
  assets that hold it are withdrawn and the hosted copy is reloaded. Its nightly backups age out
  after 14 days ([`PROVENANCE.md`](PROVENANCE.md#the-snapshot-bundle)). Git holds no page, so
  nothing in its history needs rewriting. Sentences someone saved to the Library, and the match
  reports they made, are copies kept in their browser that do not change: they stay there until
  that person removes them (each has a **Remove**).

## Limits and roadmap

- **Recall is below the case's bar** (criterion 1 in the table). A result is shown only when a
  claim it cites, or a passage on its own page, shares a word with the question. So someone found
  only through a phrase in another language stays hidden rather than shown without a reason.
- **German and French questions find less than English** (criterion 2). Word endings such as
  "Kohlenhydrate" and "Kohlenhydraten" are matched, but a claim in one language is found by a
  question in another only when Apertus's search terms bridge it.
- **Not every invented question abstains.** The ethics row of the table says how many of the 10
  do; the ones that still get results ask in French, about an invented project or with a title
  the premise check does not know.
- **UniBE is found least often** of the three sources (criterion 5).
- Explanations are written in English only, and field completeness still needs its human check.
- **In the game:** you walk the drawn map but not yet inside the office. Two optional quests say why one of their steps
  cannot be done yet: adding a source is a file in `sources/`, not an action in the app, and there
  is no network of labs and experts. What you save to the Library and your office plot stay on this
  device. A map built from swisstopo open data ([`infra/geo/`](infra/geo/README.md)) is in the
  repository but not yet drawn in the world.
- **A single claim cannot be removed on its own.** Removal works per page (`deny_paths`), so
  asking for one sentence to go takes its whole page out of the next bundle.
- **Notifications stay in the app** (the bell). Opt-in e-mail or push notifications are not
  decided yet.
- **Replay knows only recorded questions.** Every number above comes from the snapshot named
  under the table. Apertus's recorded search terms and explanations exist only for the questions
  recorded in it (capitals and spacing do not matter); any other question gets plain search, and
  the chip says so. Only a live run (`make live-run`) asks Apertus about a new question.
- Next: matching word forms and claims across languages, the human completeness labels, and a
  calibrated confidence per result.

## Team

- **Peter Dike**: engine, search and evaluation
- **Yaseen Mohamed**: backend, infrastructure and hosting
- **Nik Milcevs**: avatars, onboarding and the home

## Licence

Code under Apache-2.0 ([`LICENSE`](LICENSE)). Models: Apertus v1.5 (Swiss AI Initiative) and
multilingual-e5-small. Map geodata ©swisstopo ([`NOTICE`](NOTICE)). The case text is in
[`docs/case.md`](docs/case.md); to contribute, read [`CONTRIBUTING.md`](CONTRIBUTING.md).

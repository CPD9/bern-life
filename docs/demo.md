# Demo path

The storyline a jury member clicks through, on real public pages: a company's need, the matching
Bern experts with the sentence that proves each claim, the places lit on the map, an honest "no
source" for an invented person, and the evidence on the institution's own page.

`bun run e2e:smoke` (in `web/`) checks steps 2–5 against a running engine before a demo.

## Before you start

```bash
python -m bernlife load      # the bundle into Postgres (docs/search.md)
python -m bernlife serve     # the engine on 127.0.0.1:$ENGINE_PORT
cd web && ENGINE_URL=http://127.0.0.1:$ENGINE_PORT bun run dev
```

Replay (`BERNLIFE_BACKEND=replay`) needs no model and no GPU: every answer comes from the recorded
cache. Open http://127.0.0.1:3000. The HUD says how the engine answers (Live, Replay, MOCK, or
Engine offline) and shows only the counts the engine reports. `?story=demo` starts the jury run
with the criteria checklist beside it.

## 1. A company describes its project (needs a live model)

Phone → Ask → **Project brief**, paste the invented brief below, send.

> Muster Medtech AG (an invented company) is building a night-time alarm for people with type 1
> diabetes who live alone. We need partners in Bern for continuous glucose sensing, for detecting
> sleep and movement at night, and for testing such a device with older patients.

Apertus reads each need from a sentence of the brief; the results show which needs each expert
covers and which stay open. Reading a new brief needs the model, so run this step signed in
against `make live-run`, with a model endpoint and `LLM_CALL_BUDGET` set in `.env`. Replay has only
the briefs recorded in the bundle, and this one is not among them: there the app says that reading
a new brief needs the model.

## 2. Ask in your own words

Phone → Ask → **Question**, type:

> Is anyone in Bern building an alarm that detects low blood sugar at night in elderly people in care homes?

The results name people and units with their role and a short "why it matches", written only from
the cited claims. "Also searched for" lists the terms the search added, as search terms, never as
facts.

## 3. Show on map

Press **Show on map**. The phone closes and the map frames the places that hold results: each glows
by its best rank and carries that rank as a badge; places without a result step back. Tap a lit
place: its panel lists the matches as the same cards as Ask, and the units with their verbatim
address and source page, or, where their pages give no address, the district they are placed in
and their website. **Search here** starts a new question about that place.

## 4. Another wording, another language

> Sensor technology for continuous monitoring of multiple metabolites such as glucose, lactate and ketones

or in French:

> Capteur optique pour la surveillance continue de plusieurs métabolites (glucose, lactate, cétones)

and a service question:

> Nanopore and PacBio long-read sequencing service in Bern

## 5. An honest no-answer

> Prof. Lukas Thalmann heads the PancreaSim digital-twin lab at DCB — what has his team published?

Neither the professor nor the lab exists. The answer says there is no verifiable source instead of
inventing one, and the map stays unlit.

## 6. The sentence on the source page

Back in any result card, open a claim (a role, an expertise, a project). The evidence shows the
verbatim sentence, the page, and the date it was fetched; **Open the page at this sentence** opens
the institution's page scrolled to that sentence.

## 7. Lumi, your agent

After onboarding you land in your office (the **Home** tab). Lumi, the bear you made in the last
onboarding step, floats beside you in the office and on the map, and stands in front of the city
hall; tap either to open Lumi's chat, then ask in your own words or tap a suggestion. Lumi
searches with the engine's own tools and answers with the same cards as Ask: a person it names must
be among those results, and a reply with nothing behind it says that no verifiable source was
found. The answer goes where you would go by hand: it lights its places on the map and may open a
card in Ask, and a match report waits for your click on **Make a match report**, then opens in the
desk's Reports window. In replay Lumi searches your message and summarises the cited claims; its
own recorded answers ship with the next bundle.

At the desk, **Agents** lists Lumi's skills, such as search, Checks the premise, project brief and
match report, each with its evidence (the evaluator's numbers from `/api/numbers`, marked FIXTURE
under fixtures, and for Checks the premise two quoted results of the Apertus red-team experiment)
and a **Try** that opens it (Find opportunities opens Opportunities), and loops: saved searches
you run again by hand, whose new and dropped results reach the bell. The Garage lists the same
skills and evidence, read-only.

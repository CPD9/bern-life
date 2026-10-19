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

## 1. A company describes its project (live mode, after E3b PR 2)

Phone → Ask → **Project brief**, paste the invented brief below, send.

> Muster Medtech AG (an invented company) is building a night-time alarm for people with type 1
> diabetes who live alone. We need partners in Bern for continuous glucose sensing, for detecting
> sleep and movement at night, and for testing such a device with older patients.

Apertus reads each need from a sentence of the brief; the results show which needs each expert
covers and which stay open. This step needs the brief endpoint and a live model; once E3b's second
PR lands, the brief is recorded once live so replay plays it.

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
address and source page. **Search here** starts a new question about that place.

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

## 7. The Navigator

On the map, the three agents stand in front of the city hall. **Navigator** opens Ask; Scout and
Matchmaker open the Agents app, which says what they will do.

# Gold set notes (written 2026-10-18, before any search code)

48 lines in `gold.jsonl`: 14 site, 12 translation, 3 lay, 3 synonym, 10 invented, 6 control.
Languages: en 26, de 14, fr 8. Source tags (a line can have several): unibe 22, artorg 15, dcb 14.

## How the pages were read
Pages were downloaded one request at a time, about 1 s apart (~45 public pages), and the visible text was extracted
locally. Every proof_span was checked by exact substring match against the extracted text and against the raw HTML
with tags stripped and entities decoded. A second, independent re-fetch of the 22 proof pages matched all 100 spans
after whitespace normalisation. 14 of the 22 pages contain non-breaking spaces, so span matching must normalise
Unicode whitespace (see PREREGISTRATION.md).

## Pages used as proof
- dcb: /en/project/the-moonwalk-project/, /en/project/illuminating-personalized-medicine/, /en/project/insulin-activity-project/,
  /en/focus-area-insulin-activity/, /en/project/obesogenic-microbiota-project/,
  /en/new-endowed-lectureship-investigates-the-role-of-the-gut-microbiome-in-obesity-and-diabetes/,
  /en/focus-area-artificial-pancreas-biological-feedback/
- artorg: /research/index_eng.html, /research/{ooc,hrl,ger,uge,aihn}/index_eng.html,
  /research/aihn/research_activities/intelligent_nutrition/index_eng.html
- unibe: ngs /services/applications/ and /about_us/team/; mic /microscopy/; irm /forschung/forensische_medizin_und_bildgebung/
  and /forschung/anthropologie/; ispm research_groups_and_themes list + climate_epidemiology_and_public_health group page;
  ita.vetsuisse /forschung/index_ger.html
- Read for context, not used as proof: DCB home, team, research list, focus areas, professorship news; ARTORG home and
  HRL/AIHN group-member pages; NGS home; MIC home; IRM home and research overview; IKIM home, research and homeopathy
  pages (not used); ITA home; ISPM home.

## Uncertain or worth reviewing
- **Kässmeyer span (q010, q010b)** is just "Sabine Kässmeyer". The full sentence puts a non-breaking space (`&nbsp;`)
  before "or", so a longer span would fail a strict match. Zuber's span is shorter for the same reason. The AIHN unit
  span starts at "introduced …" because the page has `we&nbsp;introduced`.
- **Contact equals head**: Guenat (OOC), Aebischer (HRL) and Mougiakakou (AIHN) are proven by being the named contact on
  the group page that states the expertise. The group-member pages list Aebischer as "Group Leader" and Mougiakakou
  as "Group Head".
- **Spelling**: "Danai Kokona" on the insulin project page vs "Danai Kokana" on the DCB team page. Accept either.
- **Balmer (q004)**: the proof is a DCB news page about her IFIK lectureship. www.ifik.unibe.ch was not fetched, so an
  IFIK profile page for her should also count as a hit.
- **No person required** where the page names no one for that expertise: IRM Anthropologie (q012, only an e-mail
  contact), IRM Todeszeitschätzung (q026), the DCB artificial-pancreas focus area (q027; José Garcia-Tirado /
  PrecisionLab is on the team page but with no expertise text), and dog skin at Veterinär-Anatomie (q030).
- **Extras that are fine but not required**: Prof. Markus Laimer (Moonwalk), Prof. Marco Caversaccio (HRL clinical
  partner), other NGS staff.
- **q029** (ISPM environmental and spatial epidemiology, Ben Spycher) is the neutral form of the "noise and health"
  premise. I did not check whether that group works on noise in particular.
- **Pages that may change**: the DCB news page (q004) and the ITA research page (q014) are news- or project-style
  pages and could change. Re-check them before freezing.
- **Morteza Jafari (q014)** is at Inselspital dermatology, outside the listed source sites. He is named with the
  expertise on the ITA page, so he is listed. Drop him if non-unibe people should be excluded.

## Invented queries: how I checked them
The full invented names and acronyms (Studer-Kaelin, GLUCOWAVE / Reto Gfeller, Céline Morand-Hächler, ALPENHITZE /
Beat Zurbriggen, Severin Imboden-Rytz, CARDIOPLUME, PancreaSim / Lukas Thalmann, Fabienne Wyttenbach,
Noémie Rochat-Bianchi, Thomas Aeschlimann) do not appear in any fetched page. Web searches restricted to unibe.ch
and dcberne.com found none of them either. Only surnames matched, all in unrelated contexts: Zurbriggen and Gfeller
on other unibe pages, Rafael Morand in ARTORG AIHN, Judith Wyttenbach as a co-author in an ISPM publication list,
and Sarah Aeschlimann in psychology. These matches make the surname-collision cases a useful test.
The web search is not exhaustive, so this is strong evidence the names are absent, not proof.

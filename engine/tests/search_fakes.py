"""An invented two-source bundle and a word-hashing encoder, for load and search tests.

Every name, page and host is made up. The encoder hashes words into the 384 dimensions plus a
constant one, so texts sharing words are close, no vector is zero, and runs are repeatable.
"""

import hashlib
import json
import math
from pathlib import Path

from bernlife.embed import DIMENSIONS, Embedder
from bernlife.embed_command import run
from bernlife.extract_records import FIELDS
from bernlife.llm_http import ModelUnavailable
from bernlife.sources import Site, Source

FETCHED = "2026-10-18T12:00:00Z"
EXAMPLE_UNIT = "Example Institute for Engineering"
DEMO_UNIT = "Demo Centre"


def site(host: str, source_id: str, unit: str) -> Site:
    return Site(source_id, host, unit, (f"https://{host}/",), ("/",), (), 10, 0.0, None, ())


SOURCES = (
    Source("demo", "Demo Centre", (site("www.demo-centre.test", "demo", DEMO_UNIT),)),
    Source(
        "example",
        "Example Institute",
        (site("www.example-institute.test", "example", EXAMPLE_UNIT),),
    ),
)


def page(url: str, source_id: str, unit: str, title: str, text: str) -> dict[str, object]:
    return {
        "url": url,
        "source_id": source_id,
        "unit": unit,
        "fetched_at": FETCHED,
        "sha256": hashlib.sha256(text.encode()).hexdigest(),
        "status": 200,
        "lang": "en",
        "title": title,
        "kind": "person",
        "text": text,
    }


def claim(on: dict[str, object], value: str, span: str | None = None) -> dict[str, object]:
    span = span or value
    evidence = {
        "page_url": on["url"],
        "page_sha256": on["sha256"],
        "span": span,
        "start": str(on["text"]).index(span),
        "fetched_at": FETCHED,
    }
    return {"value": value, "method": "selector", "evidence": evidence}


def profile(
    profile_id: str, on: dict[str, object], name: str, **fields: list[dict[str, object]]
) -> dict[str, object]:
    return {
        "id": profile_id,
        "kind": profile_id.split("-")[0],
        "source_id": on["source_id"],
        "name": claim(on, name),
        "source_url": on["url"],
        "fields": {field: fields.get(field, []) for field in FIELDS},
    }


ADA_PAGE = page(
    "https://www.example-institute.test/team/ada-muster",
    "example",
    EXAMPLE_UNIT,
    "Ada Muster - Example Institute",
    "Dr. Ada Muster\nGroup Leader, Sensor Lab\n"
    "Research: continuous glucose monitoring and wearable biosensors.",
)
DORA_PAGE = page(
    "https://www.example-institute.test/team/dora-demo",
    "example",
    EXAMPLE_UNIT,
    "Dora Demo - Example Institute",
    "Dora Demo\nPostdoc\nResearch: cryogenic electron microscopy of membrane proteins.",
)
PATCH_PAGE = page(
    "https://www.example-institute.test/projects/glucopatch",
    "example",
    EXAMPLE_UNIT,
    "GlucoPatch - Example Institute",
    "GlucoPatch\nA skin-worn patch for people with type 1 diabetes.\n"
    "Project team: Dr. Ada Muster (lead), Ben Beispiel (engineer)",
)
CLEO_PAGE = page(
    "https://www.demo-centre.test/people/cleo-beispiel",
    "demo",
    DEMO_UNIT,
    "Cleo Beispiel - Demo Centre",
    "Cleo Beispiel\nResearch: glucose metabolism in mice.",
)
APP_PAGE = page(
    "https://www.demo-centre.test/projects/carb-counter",
    "demo",
    DEMO_UNIT,
    "Carb Counter - Demo Centre",
    "Carb Counter\nA phone app for carbohydrate estimation from meal photos.\n"
    "Project team: Emil Exempel",
)
PAGES = [CLEO_PAGE, ADA_PAGE, PATCH_PAGE, DORA_PAGE, APP_PAGE]

PROFILES = [
    profile(
        "person-demo-cleo-beispiel",
        CLEO_PAGE,
        "Cleo Beispiel",
        expertise=[claim(CLEO_PAGE, "glucose metabolism in mice")],
    ),
    profile(
        "person-example-ada-muster",
        ADA_PAGE,
        "Ada Muster",
        role=[claim(ADA_PAGE, "Group Leader", "Group Leader, Sensor Lab")],
        unit=[claim(ADA_PAGE, "Sensor Lab")],
        expertise=[
            claim(ADA_PAGE, "continuous glucose monitoring"),
            claim(ADA_PAGE, "wearable biosensors"),
        ],
    ),
    profile("person-example-ben-beispiel", PATCH_PAGE, "Ben Beispiel"),
    profile(
        "person-example-dora-demo",
        DORA_PAGE,
        "Dora Demo",
        role=[claim(DORA_PAGE, "Postdoc")],
        expertise=[claim(DORA_PAGE, "cryogenic electron microscopy of membrane proteins")],
    ),
    profile("project-example-glucopatch", PATCH_PAGE, "GlucoPatch"),
    profile("person-demo-emil-exempel", APP_PAGE, "Emil Exempel"),
    profile(
        "project-demo-carb-counter",
        APP_PAGE,
        "Carb Counter",
        expertise=[claim(APP_PAGE, "carbohydrate estimation from meal photos")],
    ),
]
RELATIONS = [
    {
        "from_profile_id": "person-example-ada-muster",
        "to_profile_id": "project-example-glucopatch",
        "kind": "works_on",
        "method": "selector",
        "page_url": PATCH_PAGE["url"],
        "page_sha256": PATCH_PAGE["sha256"],
        "span": "Project team: Dr. Ada Muster (lead)",
        "start": str(PATCH_PAGE["text"]).index("Project team"),
    },
    {
        "from_profile_id": "person-demo-emil-exempel",
        "to_profile_id": "project-demo-carb-counter",
        "kind": "works_on",
        "method": "selector",
        "page_url": APP_PAGE["url"],
        "page_sha256": APP_PAGE["sha256"],
        "span": "Project team: Emil Exempel",
        "start": str(APP_PAGE["text"]).index("Project team"),
    },
]


def hashed_encode(texts: list[str]) -> list[list[float]]:
    vectors = []
    for text in texts:
        vector = [0.0] * DIMENSIONS
        vector[0] = 1.0
        for word in text.lower().replace(":", " ").split():
            index = 1 + int(hashlib.sha256(word.encode()).hexdigest(), 16) % (DIMENSIONS - 1)
            vector[index] += 1.0
        norm = math.sqrt(sum(x * x for x in vector))
        vectors.append([x / norm for x in vector])
    return vectors


def fake_embedder() -> Embedder:
    return Embedder(hashed_encode)


class FakeChat:
    """A connected model with canned replies per role, counting what it was asked. A role with no
    reply fails like an unreachable model."""

    def __init__(self, replies: dict[str, object], backend: str = "replay"):
        self.replies, self.backend = replies, backend
        self.asked: list[str] = []

    def chat(self, messages, *, role, prompt_version, temperature=0.0, seed=None, max_tokens=700):
        self.asked.append(role)
        reply = self.replies.get(role, ModelUnavailable("unreachable"))
        if isinstance(reply, Exception):
            raise reply
        return reply if isinstance(reply, str) else json.dumps(reply)

    def models(self) -> dict[str, str]:
        return dict.fromkeys(("expand", "enrich", "extract", "explain", "brief"), "fake-70b")


KRYO_TERM = {
    "value": "cryogenic electron microscopy of membrane proteins",
    "term": "Kryo-Elektronenmikroskopie",
    "kind": "translation",
    "lang": "de",
    "model": "fake-70b",
    "prompt_version": "enrich-v1",
}


def write_bundle(
    folder: Path,
    profiles: list[dict[str, object]] = PROFILES,
    terms: list[dict[str, object]] = (),
) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    files = (("pages", PAGES), ("profiles", profiles), ("relations", RELATIONS), ("terms", terms))
    for name, records in files:
        text = "".join(json.dumps(record) + "\n" for record in records)
        (folder / f"{name}.jsonl").write_text(text)
    run(folder, fake_embedder())


def truncate_all(conn) -> None:
    """Inside a test's rolled-back transaction: an empty database, whatever a lane loaded."""
    conn.execute("TRUNCATE source, site, page, profile, chunk, term, bundle_load CASCADE")

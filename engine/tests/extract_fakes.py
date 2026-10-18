"""Invented pages in the shapes the real sites use, and a fake model keyed by page text.

Nobody here exists. The CMS pages follow UniBE's layout (institute line, section, name, role,
affiliation); the team list follows a platform's "Name / Funktion" table.
"""

import hashlib
import json

from bernlife.cache import Message
from bernlife.extract_records import Page

HOST = "https://www.example-institute.test"
INSTITUTE = "Example Institute for Engineering"
ADA_ENG = f"{HOST}/about_us/people/muster_ada/index_eng.html"
ADA_GER = f"{HOST}/about_us/people/muster_ada/index_ger.html"
LAB = f"{HOST}/research/sensor_lab/index_eng.html"
TEAM = f"{HOST}/about_us/team/index_eng.html"
DORA = "https://network.example.test/team/dr-dora-demo/"


def page(url: str, title: str, text: str, kind: str, lang: str = "en") -> Page:
    return Page(
        url=url,
        source_id="example",
        unit=INSTITUTE,
        fetched_at="2026-10-18T12:00:00Z",
        sha256=hashlib.sha256(text.encode()).hexdigest(),
        kind=kind,
        lang=lang,
        title=title,
        text=text,
    )


ADA_PAGE = page(
    ADA_ENG,
    f"About us: Prof. Dr. Ada Muster - {INSTITUTE}",
    f"{INSTITUTE}\nPeople\nProf. Dr. Ada Muster\nGroup Leader\n"
    f"University of Bern, {INSTITUTE}, Sensor Lab\nPhone\n[phone]\nE-Mail\n[email]\n"
    "Ada Muster develops wearable biosensors for continuous glucose monitoring.",
    "person",
)
ADA_TWIN = page(
    ADA_GER,
    "Über uns: Prof. Dr. Ada Muster - Beispielinstitut für Technik",
    "Beispielinstitut für Technik\nPersonen\nProf. Dr. Ada Muster\nGruppenleiterin\n"
    "Telefon\n[phone]",
    "person",
    "de",
)
LAB_PAGE = page(
    LAB,
    f"Research: Sensor Lab - {INSTITUTE}",
    f"{INSTITUTE}\nResearch\nSensor Lab\nThe Sensor Lab is headed by Dr. Ada Muster.\n"
    "Ben Beispiel works on GlucoPatch, a skin-worn sensor.\n"
    "We operate a cleanroom for thin-film sensor fabrication.",
    "unit",
)
TEAM_PAGE = page(
    TEAM,
    f"About us: Team - {INSTITUTE}",
    f"{INSTITUTE}\nTeam\nName / Titel\nCara Probst, PhD\nFunktion\nLab Manager\nMail\n[email]",
    "listing",
)
DORA_PAGE = page(DORA, "Dr. Dora Demo – NETWORK", "Dr. Dora Demo\n[email]", "person")
PAGES = (ADA_PAGE, ADA_TWIN, LAB_PAGE, TEAM_PAGE, DORA_PAGE)

REPLIES = {
    "wearable biosensors": {
        "subject": {
            "expertise": [
                {"value": "wearable biosensors", "span": "develops wearable biosensors"},
                {"value": "continuous glucose monitoring", "span": "continuous glucose monitoring"},
                {"value": "insulin pumps", "span": "insulin pumps for children"},
            ],
            "role": [{"value": "Group Leader", "span": "Group Leader"}],
        },
        "people": [],
    },
    "headed by": {
        "subject": {
            "infrastructure": [
                {
                    "value": "cleanroom for thin-film sensor fabrication",
                    "span": "We operate a cleanroom for thin-film sensor fabrication.",
                }
            ],
            "projects": [{"value": "GlucoPatch", "span": "Ben Beispiel works on GlucoPatch"}],
        },
        "people": [
            {
                "name": {"value": "Dr. Ada Muster", "span": "headed by Dr. Ada Muster"},
                "role": [],
                "relation": "lead",
            },
            {
                "name": {"value": "Ben Beispiel", "span": "Ben Beispiel works on GlucoPatch"},
                "role": [{"value": "sensor", "span": "a skin-worn sensor."}],
                "relation": "lead",
            },
            {
                "name": {"value": "Erika Erfunden", "span": "Erika Erfunden leads the lab"},
                "relation": "member",
            },
        ],
    },
    "Cara Probst": {
        "people": [
            {
                "name": {"value": "Cara Probst", "span": "Cara Probst, PhD"},
                "role": [
                    {"value": "Lab Manager", "span": "Cara Probst, PhD\nFunktion\nLab Manager"}
                ],
                "relation": "member",
            }
        ]
    },
}


class FakeModel:
    """Answers with the reply whose marker occurs in the page; unknown pages get prose."""

    def __init__(self, replies: dict[str, object] | None = None) -> None:
        self.replies = REPLIES if replies is None else replies
        self.calls: list[list[Message]] = []

    def __call__(self, messages: list[Message]) -> str:
        self.calls.append(messages)
        content = messages[-1]["content"]
        for marker, reply in self.replies.items():
            if marker in content:
                return "Here you are:\n" + json.dumps(reply)
        return "I could not find anything."

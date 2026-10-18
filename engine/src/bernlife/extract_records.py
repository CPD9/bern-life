"""Records passed between the extraction steps.

A Candidate is what a selector or the model proposes; only the verifier turns it into a Claim.
Subjects compare by kind, source and key, never by display name, so the same person found on two
pages under two spellings meets in one profile.
"""

from dataclasses import dataclass, field

FIELDS = ("role", "unit", "expertise", "projects", "infrastructure", "services")
PROFILE_KINDS = ("person", "unit", "project", "infrastructure")


@dataclass(frozen=True)
class Page:
    url: str
    source_id: str
    unit: str
    fetched_at: str
    sha256: str
    kind: str
    lang: str
    title: str
    text: str

    @classmethod
    def from_record(cls, record: dict[str, object]) -> "Page":
        return cls(
            url=str(record["url"]),
            source_id=str(record["source_id"]),
            unit=str(record["unit"]),
            fetched_at=str(record["fetched_at"]),
            sha256=str(record["sha256"]),
            kind=str(record.get("kind", "other")),
            lang=str(record.get("lang", "unknown")),
            title=str(record.get("title", "")),
            text=str(record["text"]),
        )


@dataclass(frozen=True)
class Subject:
    """A profile to be. `key` is `name:<folded name>`, `url:<twin url>`, `page:<host>:<name>`
    or `host:<host>`."""

    kind: str
    source_id: str
    key: str
    name: str = field(compare=False)


@dataclass(frozen=True)
class Candidate:
    subject: Subject
    field: str  # "name" or one of FIELDS
    value: str
    span: str
    method: str
    page_url: str


@dataclass(frozen=True)
class RelationCandidate:
    origin: Subject
    target: Subject
    kind: str
    span: str
    method: str
    page_url: str


@dataclass(frozen=True)
class Evidence:
    page_url: str
    page_sha256: str
    span: str
    start: int
    fetched_at: str

    def as_record(self) -> dict[str, object]:
        return {
            "page_url": self.page_url,
            "page_sha256": self.page_sha256,
            "span": self.span,
            "start": self.start,
            "fetched_at": self.fetched_at,
        }


@dataclass(frozen=True)
class Claim:
    subject: Subject
    field: str
    value: str
    method: str
    evidence: Evidence


@dataclass(frozen=True)
class Relation:
    origin: Subject
    target: Subject
    kind: str
    method: str
    evidence: Evidence

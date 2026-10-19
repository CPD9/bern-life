"""Headings that name a list of things, never one thing.

UniBE's URL rules file a page under /services/ or /research/ as an infrastructure, unit or project
page, so a page that only lists services or projects got a profile named after its heading
("Services", "Thesis Projects") and came back in search like a facility or a project. The match
is exact, headings as the sites write them: a real name that contains one of these words
("IT Services", "Flow Cytometry Core Facility") stays a name.
"""

LISTING_NAMES = frozenset(
    {"Services", "Our Services", "Dienstleistungen", "Applications", "Core Facilities"}
    | {"Local Platforms", "Group Leaders", "Events", "Past events", "Past Trainings"}
    | {"Projects", "Ended Projects", "Former Projects", "Ongoing Projects", "Current projects"}
    | {"Laufende Projekte", "Research Projects", "Student Projects", "Thesis Projects"}
    | {"MSc Thesis Projects", "PhD Projects", "Project websites"}
)


def is_listing_name(name: str) -> bool:
    return name in LISTING_NAMES

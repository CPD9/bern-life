"""What a turn without the model searches: the user's last message or, when it has nothing to look
for ("Show them on the map", "Zeig sie auf der Karte", "Montre-les sur la carte"), the user's most
recent earlier message that has.

A word is topical unless it is one of matching.py's stopwords or of FOLLOW_UP_WORDS: the short
function words that matching.py drops by length, and the words of asking to show, place or repeat
something, in English, German and French. Only the user's own messages are searched; an assistant
turn comes from the browser.
"""

from collections.abc import Mapping, Sequence

from bernlife.api_requests import MAX_QUERY
from bernlife.matching import STOPWORDS
from bernlife.names import fold

FOLLOW_UP_WORDS = frozenset(
    # English
    {"a", "i", "me", "us", "it", "is", "be", "do", "on", "in", "at", "to", "of", "by", "or", "so"}
    | {"ok", "okay", "yes", "hi", "hello", "thanks", "thank", "please", "show", "display", "see"}
    | {"map", "maps", "again", "more", "tell", "list", "give", "let", "now", "too", "just", "only"}
    | {"one", "ones", "here", "him", "she", "he", "located"}
    # German
    | {"zeig", "zeige", "zeigen", "karte", "karten", "landkarte", "stadtplan", "bitte", "nochmal"}
    | {"noch", "mehr", "mir", "ihnen", "ihn", "alle", "davon", "dort", "hier", "wo", "es", "er"}
    | {"im", "am", "zu", "da", "ja", "danke", "hallo", "liegen"}
    # French
    | {"montre", "montrez", "montrer", "affiche", "affichez", "afficher", "carte", "cartes", "vous"}
    | {"plait", "moi", "eux", "elles", "elle", "ils", "il", "tous", "toutes", "ici", "encore"}
    | {"merci", "bonjour", "oui", "la", "le", "l", "de", "du", "et", "ou", "en", "s", "y"}
)
NOT_TOPICAL = STOPWORDS | FOLLOW_UP_WORDS


def search_query(messages: Sequence[Mapping[str, str]]) -> str:
    """The last message, or the most recent earlier user message with a topical word."""
    asked = [_query(m["content"]) for m in messages[:-1] if m["role"] == "user"]
    last = _query(messages[-1]["content"])
    return next((text for text in reversed([*asked, last]) if is_topical(text)), last)


def is_topical(text: str) -> bool:
    return any(word not in NOT_TOPICAL for word in fold(text).split())


def _query(text: str) -> str:
    return " ".join(text.split())[:MAX_QUERY]

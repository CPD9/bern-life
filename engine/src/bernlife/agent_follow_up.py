"""What a turn without the model searches: the user's last message or, when it only asks to see the
earlier results again ("Show them on the map", "Zeig sie auf der Karte", "Montre-les sur la
carte"), the user's most recent earlier message that asks about something.

A message is a follow-up when every word of it is one of FOLLOW_UP_WORDS, a closed list in English,
German and French: words that point back, words of showing, placing or repeating, greetings and
thanks, and short function words. It holds no question word and no word of researching, so "Who
works on maps?" or "Qui travaille sur les cartes ?" names its topic and is searched as written.
Only the user's own messages are searched; an assistant turn comes from the browser.
"""

from collections.abc import Mapping, Sequence

from bernlife.api_requests import MAX_QUERY
from bernlife.names import fold

FOLLOW_UP_WORDS = frozenset(
    # English
    {"them", "they", "those", "these", "their", "him", "her", "he", "she", "it", "one", "ones"}
    | {"show", "display", "see", "put", "mark", "map", "maps", "plan", "where", "located", "here"}
    | {"there", "again", "more", "tell", "list", "give", "let", "now", "too", "just", "only", "all"}
    | {"ok", "okay", "yes", "hi", "hello", "thanks", "thank", "please", "a", "the", "and", "i"}
    | {"me", "us", "you", "is", "are", "be", "do", "can", "could", "would", "will", "on", "in"}
    | {"at", "to", "of", "by", "or", "so"}
    # German
    | {"sie", "ihnen", "ihn", "es", "er", "alle", "diese", "davon", "zeig", "zeige", "zeigen"}
    | {"markier", "markiere", "karte", "karten", "landkarte", "stadtplan", "wo", "befinden"}
    | {"befindet", "liegen", "liegt", "dort", "hier", "da", "nochmal", "noch", "mehr", "bitte"}
    | {"danke", "hallo", "ja", "der", "die", "das", "den", "dem", "und", "mir", "uns", "du"}
    | {"kannst", "kann", "konnen", "konnten", "sich", "an", "auf", "im", "am", "zu", "ist", "sind"}
    # French
    | {"les", "eux", "ils", "elles", "elle", "il", "tous", "toutes", "montre", "montrez"}
    | {"montrer", "affiche", "affichez", "afficher", "carte", "cartes", "ou", "trouvent", "trouve"}
    | {"sont", "est", "ici", "encore", "plus", "merci", "bonjour", "oui", "plait", "moi", "nous"}
    | {"vous", "te", "tu", "peux", "pouvez", "se", "s", "m", "la", "le", "l", "de", "du", "et"}
    | {"en", "y", "sur"}
)


def search_query(messages: Sequence[Mapping[str, str]]) -> str:
    """The last message, or the most recent earlier user message that is no follow-up."""
    asked = [_query(m["content"]) for m in messages[:-1] if m["role"] == "user"]
    last = _query(messages[-1]["content"])
    return next((text for text in reversed([*asked, last]) if not is_follow_up(text)), last)


def is_follow_up(text: str) -> bool:
    return all(word in FOLLOW_UP_WORDS for word in fold(text).split())


def _query(text: str) -> str:
    return " ".join(text.split())[:MAX_QUERY]

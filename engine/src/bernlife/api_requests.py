"""The bodies the API accepts (contracts/api.md), parsed and checked before anything runs.

Anything outside the contract is refused whole with `BadRequest`, never trimmed to fit: a caller
that sent the wrong shape learns it at once instead of getting an answer to another question.
"""

import json
from dataclasses import dataclass

from bernlife.cache import Message
from bernlife.extract_records import PROFILE_KINDS

LANGS = ("de", "en", "fr")
MAX_QUERY = 500
MAX_BRIEF = 20_000
MAX_MESSAGES = 12
MESSAGE_ROLES = ("user", "assistant")


class BadRequest(ValueError):
    pass


@dataclass(frozen=True)
class SearchRequest:
    query: str
    lang: str | None
    sources: list[str] | None
    kinds: list[str] | None = None


def is_clean(text: str) -> bool:
    """No NUL, which Postgres refuses, and no lone surrogate, which UTF-8 cannot carry back out."""
    try:
        text.encode("utf-8")
    except UnicodeEncodeError:
        return False
    return "\x00" not in text


def _json(body: bytes) -> object:
    try:
        return json.loads(body)
    except ValueError:
        raise BadRequest("not JSON") from None


def parse_search(body: bytes, source_ids: set[str]) -> SearchRequest:
    payload = _json(body)
    if not isinstance(payload, dict) or set(payload) - {"query", "lang", "sources", "kinds"}:
        raise BadRequest("unexpected fields")
    query, lang, sources = payload.get("query"), payload.get("lang"), payload.get("sources")
    kinds = payload.get("kinds")
    if not isinstance(query, str) or not 0 < len(query.strip()) <= MAX_QUERY:
        raise BadRequest("query")
    if not is_clean(query):
        raise BadRequest("query")
    if lang is not None and lang not in LANGS:
        raise BadRequest("lang")
    if sources is not None and (
        not isinstance(sources, list) or not sources or not set(sources) <= source_ids
    ):
        raise BadRequest("sources")
    if kinds is not None and (
        not isinstance(kinds, list) or not kinds or not set(kinds) <= set(PROFILE_KINDS)
    ):
        raise BadRequest("kinds")
    return SearchRequest(
        query.strip(),
        lang,
        sorted(set(sources)) if sources else None,
        sorted(set(kinds)) if kinds else None,
    )


def parse_brief(body: bytes) -> str:
    payload = _json(body)
    if not isinstance(payload, dict) or set(payload) != {"text"}:
        raise BadRequest("fields")
    text = payload["text"]
    if not isinstance(text, str) or not 0 < len(text.strip()) <= MAX_BRIEF or not is_clean(text):
        raise BadRequest("text")
    return text


def is_message(item: object) -> bool:
    return (
        isinstance(item, dict)
        and set(item) == {"role", "content"}
        and item["role"] in MESSAGE_ROLES
        and isinstance(item["content"], str)
        and is_clean(item["content"])
    )


def parse_agent(body: bytes) -> list[Message]:
    """The conversation so far, newest last; the agent answers its last message, the user's."""
    payload = _json(body)
    if not isinstance(payload, dict) or set(payload) != {"messages"}:
        raise BadRequest("fields")
    messages = payload["messages"]
    if not isinstance(messages, list) or not 0 < len(messages) <= MAX_MESSAGES:
        raise BadRequest("messages")
    if not all(is_message(item) for item in messages):
        raise BadRequest("messages")
    if messages[-1]["role"] != "user" or not messages[-1]["content"].strip():
        raise BadRequest("last message")
    return [{"role": item["role"], "content": item["content"]} for item in messages]

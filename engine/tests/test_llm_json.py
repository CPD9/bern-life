import unittest
from collections.abc import Sequence

from bernlife.cache import Message
from bernlife.llm_http import ModelUnavailable
from bernlife.llm_json import REPAIR, ask_json

ASK = "Return synonyms for 'glucose sensors' as JSON."


class ScriptedChat:
    backend = "fake"

    def __init__(self, *replies: str) -> None:
        self.replies = list(replies)
        self.calls: list[list[Message]] = []

    def chat(
        self,
        messages: Sequence[Message],
        *,
        role: str,
        prompt_version: str,
        temperature: float = 0.0,
        seed: int | None = None,
        max_tokens: int = 700,
    ) -> str:
        self.calls.append(list(messages))
        return self.replies.pop(0)

    def models(self) -> dict[str, str]:
        return {}


def ask(llm: ScriptedChat) -> dict[str, object]:
    return ask_json(llm, ASK, role="expand", prompt_version="expand-v1")


class AskJsonTest(unittest.TestCase):
    def test_fenced_object_is_read_in_one_call(self) -> None:
        llm = ScriptedChat('Here you go:\n```json\n{"terms": ["CGM"]}\n```')
        self.assertEqual(ask(llm), {"terms": ["CGM"]})
        self.assertEqual(len(llm.calls), 1)

    def test_truncated_object_is_repaired_by_a_second_call(self) -> None:
        cut = '{"terms": ["CGM", "glucose sen'
        llm = ScriptedChat(cut, '{"terms": ["CGM", "glucose sensor"]}')
        self.assertEqual(ask(llm), {"terms": ["CGM", "glucose sensor"]})
        self.assertEqual(
            llm.calls[1],
            [
                {"role": "user", "content": ASK},
                {"role": "assistant", "content": cut},
                {"role": "user", "content": REPAIR},
            ],
        )
        self.assertEqual(llm.calls[0], [{"role": "user", "content": ASK}])

    def test_raw_newline_in_a_string_is_the_last_resort(self) -> None:
        llm = ScriptedChat("no json here", '{"why": "line one\nline two"}')
        self.assertEqual(ask(llm), {"why": "line one\nline two"})

    def test_unparsable_after_repair_is_the_bad_json_marker(self) -> None:
        with self.assertRaises(ModelUnavailable) as raised:
            ask(ScriptedChat("no json here", "still none"))
        self.assertEqual(str(raised.exception), "bad_json")


if __name__ == "__main__":
    unittest.main()

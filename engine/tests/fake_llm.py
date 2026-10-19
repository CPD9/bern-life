"""A scripted stand-in for an OpenAI-compatible endpoint, passed to the code as its transport."""

import io
import json
import urllib.error
import urllib.request
from email.message import Message


class FakeTransport:
    """Answers each request with the next step of a script: bytes are a body, an exception is
    raised. Records every request so tests can check the URL, the key header, the count and the
    JSON body sent."""

    def __init__(self, *script: bytes | BaseException) -> None:
        self.script = list(script)
        self.requests: list[tuple[str, str | None]] = []
        self.bodies: list[object] = []

    def __call__(self, request: urllib.request.Request, timeout: float) -> bytes:
        self.requests.append((request.full_url, request.get_header("Authorization")))
        self.bodies.append(None if request.data is None else json.loads(request.data))
        step = self.script.pop(0)
        if isinstance(step, BaseException):
            raise step
        return step


def models_body(*ids: str) -> bytes:
    return json.dumps({"object": "list", "data": [{"id": model} for model in ids]}).encode()


def chat_body(content: str) -> bytes:
    return json.dumps(
        {"choices": [{"message": {"role": "assistant", "content": content}}]}
    ).encode()


def tool_body(content: str | None, *calls: tuple[str, str, object]) -> bytes:
    """A model reply with tool calls, each (id, name, arguments), the arguments as JSON text."""
    tool_calls = [
        {"id": id_, "type": "function", "function": {"name": name, "arguments": json.dumps(args)}}
        for id_, name, args in calls
    ]
    message = {"role": "assistant", "content": content, "tool_calls": tool_calls}
    return json.dumps({"choices": [{"message": message}]}).encode()


def http_error(status: int, text: str) -> urllib.error.HTTPError:
    body = io.BytesIO(json.dumps({"error": {"message": text}}).encode())
    return urllib.error.HTTPError("https://gateway.example/v1", status, text, Message(), body)

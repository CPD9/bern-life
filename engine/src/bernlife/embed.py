"""Text to vectors with multilingual-e5-small, pinned to one revision and one ONNX file.

e5 was trained with `query: ` and `passage: ` prefixes, so the prefixes live here, in one place,
around whatever encoder is plugged in: tests pass a fake encoder, the engine passes the ONNX model.
A query is always encoded alone, because batching pads it and moves the vector in the last digits.
"""

import hashlib
from collections.abc import Callable, Sequence
from pathlib import Path

from bernlife.chunks import passage_input, query_input

MODEL = "intfloat/multilingual-e5-small"
REVISION = "614241f622f53c4eeff9890bdc4f31cfecc418b3"
MODEL_ID = f"{MODEL}@{REVISION[:8]}"
ONNX_FILE = "onnx/model.onnx"
ONNX_SHA256 = "ca456c06b3a9505ddfd9131408916dd79290368331e7d76bb621f1cba6bc8665"
TOKENIZER_FILES = (
    "config.json",
    "special_tokens_map.json",
    "tokenizer.json",
    "tokenizer_config.json",
)
DIMENSIONS = 384
BATCH = 32

Encode = Callable[[list[str]], list[list[float]]]


class ModelFileMismatch(RuntimeError):
    pass


class Embedder:
    def __init__(self, encode: Encode):
        self._encode = encode

    def query(self, text: str) -> list[float]:
        return self._encode([query_input(text)])[0]

    def passages(self, texts: Sequence[str]) -> list[list[float]]:
        vectors: list[list[float]] = []
        for start in range(0, len(texts), BATCH):
            batch = [passage_input(text) for text in texts[start : start + BATCH]]
            vectors += self._encode(batch)
        return vectors


def model_dir(data_dir: Path) -> Path:
    return data_dir / "models" / "multilingual-e5-small"


def ensure_model(data_dir: Path) -> Path:
    """Download the pinned files once and refuse an ONNX file whose hash is not the pinned one."""
    from huggingface_hub import snapshot_download

    folder = model_dir(data_dir)
    if not (folder / ONNX_FILE).exists():
        snapshot_download(
            MODEL,
            revision=REVISION,
            allow_patterns=[ONNX_FILE, *TOKENIZER_FILES],
            local_dir=str(folder),
        )
    digest = hashlib.sha256()
    with (folder / ONNX_FILE).open("rb") as onnx:
        while block := onnx.read(1 << 20):
            digest.update(block)
    if digest.hexdigest() != ONNX_SHA256:
        raise ModelFileMismatch(f"{folder / ONNX_FILE} is not the pinned {MODEL_ID}")
    return folder


def e5_embedder(data_dir: Path) -> Embedder:
    from fastembed import TextEmbedding
    from fastembed.common.model_description import ModelSource, PoolingType

    folder = ensure_model(data_dir)
    if MODEL not in {model["model"] for model in TextEmbedding.list_supported_models()}:
        TextEmbedding.add_custom_model(
            model=MODEL,
            pooling=PoolingType.MEAN,
            normalization=True,
            sources=ModelSource(hf=MODEL),
            dim=DIMENSIONS,
            model_file=ONNX_FILE,
        )
    model = TextEmbedding(MODEL, specific_model_path=str(folder))

    def encode(texts: list[str]) -> list[list[float]]:
        return [vector.tolist() for vector in model.embed(texts, batch_size=BATCH)]

    return Embedder(encode)

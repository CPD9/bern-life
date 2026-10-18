"""One entry point, `python -m bernlife <command>`, so playbooks and the Makefile name one thing.

Each command is a module with a `main(argv)` function; adding a command is one line in COMMANDS.
"""

import importlib
import sys

COMMANDS: dict[str, tuple[str, str]] = {
    "calibrate": ("bernlife.calibrate_command", "abstention signals per dev query"),
    "check-places": ("bernlife.places_check", "confirm the map's addresses against stored pages"),
    "crawl": ("bernlife.crawl_command", "fetch allowed pages of sources/*.json into the bundle"),
    "embed": ("bernlife.embed_command", "a vector for every chunk text into vectors.jsonl"),
    "extract": ("bernlife.extract_command", "pages into profiles and relations with evidence"),
    "health": ("bernlife.health", "model mode, model per role, recorded calls"),
    "load": ("bernlife.load_command", "the bundle into Postgres, one transaction per source"),
    "predict": ("bernlife.predict_command", "every gold query through search, for the evaluator"),
    "serve": ("bernlife.serve_command", "the engine HTTP API on 127.0.0.1:$ENGINE_PORT"),
}


def usage() -> str:
    rows = [f"  {name:<10} {help_text}" for name, (_, help_text) in sorted(COMMANDS.items())]
    return "usage: python -m bernlife <command> [args]\n\ncommands:\n" + "\n".join(rows)


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    if not args or args[0] not in COMMANDS:
        print(usage(), file=sys.stderr)
        return 2
    module_name, _ = COMMANDS[args[0]]
    return importlib.import_module(module_name).main(args[1:])


if __name__ == "__main__":
    sys.exit(main())

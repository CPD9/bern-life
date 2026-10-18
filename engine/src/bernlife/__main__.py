"""One entry point, `python -m bernlife <command>`, so playbooks and the Makefile name one thing.

Each command is a module with a `main(argv)` function; adding a command is one line in COMMANDS.
"""

import importlib
import sys

COMMANDS: dict[str, tuple[str, str]] = {
    "health": ("bernlife.health", "model mode, model per role, recorded calls"),
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

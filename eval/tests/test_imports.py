import ast
import unittest
from pathlib import Path

PACKAGE = Path(__file__).resolve().parents[1] / "src" / "evaluator"


def imported(path: Path) -> set[str]:
    names = set()
    for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        if isinstance(node, ast.Import):
            names |= {alias.name for alias in node.names}
        elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
            names.add(node.module)
    return names


class SeparateFromSearchTest(unittest.TestCase):
    def test_no_module_imports_the_engine(self) -> None:
        modules = sorted(PACKAGE.glob("*.py"))
        self.assertGreater(len(modules), 5)
        for module in modules:
            with self.subTest(module=module.name):
                engine = {
                    n for n in imported(module) if n == "bernlife" or n.startswith("bernlife.")
                }
                self.assertEqual(engine, set())
                self.assertNotIn("engine/src", module.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()

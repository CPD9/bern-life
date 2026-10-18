import io
import unittest
from contextlib import redirect_stderr

from bernlife.__main__ import main


class MainTest(unittest.TestCase):
    def test_unknown_command_prints_usage_and_returns_2(self):
        err = io.StringIO()
        with redirect_stderr(err):
            code = main(["nope"])
        self.assertEqual(code, 2)
        self.assertTrue(err.getvalue().startswith("usage: python -m bernlife <command> [args]"))


if __name__ == "__main__":
    unittest.main()

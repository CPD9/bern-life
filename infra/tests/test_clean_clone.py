import subprocess
import tempfile
import unittest
from collections.abc import Mapping, Sequence
from pathlib import Path

from infra.clean_clone import Step, clone_env, committable_files, judge_path, report

RESPONSE = {"abstained": False, "results": [{"id": "person-fixture-a"}, {"id": "unit-fixture"}]}


class Commands:
    def __init__(self, failing: str | None = None):
        self.failing = failing
        self.calls: list[tuple[list[str], Path, str]] = []

    def __call__(self, command: Sequence[str], cwd: Path, env: Mapping[str, str]) -> int:
        self.calls.append((list(command), cwd, env["COMPOSE_PROJECT_NAME"]))
        return 1 if command[-1] == self.failing else 0


class Ticks:
    def __init__(self, *times: float):
        self.times = list(times)

    def __call__(self) -> float:
        return self.times.pop(0)


class CloneEnvTest(unittest.TestCase):
    def test_drops_the_developers_data_and_database_and_names_its_own_project(self):
        env = clone_env(
            {
                "PATH": "/usr/bin",
                "GH_TOKEN": "token-value",
                "BERNLIFE_DATA_DIR": "/shared/data",
                "DATABASE_URL": "postgresql://x@127.0.0.1:5433/bernlife",
                "COMPOSE_PROJECT_NAME": "bernlife",
            },
            web_port=3013,
            db_port=5443,
        )
        self.assertEqual(
            env,
            {
                "PATH": "/usr/bin",
                "GH_TOKEN": "token-value",
                "COMPOSE_PROJECT_NAME": "bernlife-clean",
                "WEB_PORT": "3013",
                "DB_PORT": "5443",
            },
        )


class JudgePathTest(unittest.TestCase):
    def setUp(self):
        self.clone = Path("/tmp/clone")
        self.env = clone_env({}, web_port=3000, db_port=5434)
        self.searches: list[tuple[str, str]] = []

    def search(self, url: str, query: str) -> dict[str, object]:
        self.searches.append((url, query))
        return RESPONSE

    def test_fetches_runs_and_searches_once_timing_each_step(self):
        commands = Commands()
        steps, response = judge_path(
            self.clone, self.env, 3000, "diabetes technology", True,
            run=commands, search=self.search, now=Ticks(0, 12.5, 12.5, 100, 100, 100.25),
        )  # fmt: skip
        self.assertEqual([call[0] for call in commands.calls], [["make", "fetch"], ["make", "run"]])
        self.assertEqual({call[2] for call in commands.calls}, {"bernlife-clean"})
        self.assertEqual(self.searches, [("http://127.0.0.1:3000", "diabetes technology")])
        self.assertEqual(steps, [Step("fetch", 12.5), Step("run", 87.5), Step("search", 0.25)])
        self.assertEqual(response, RESPONSE)

    def test_a_local_bundle_skips_fetch(self):
        commands = Commands()
        judge_path(
            self.clone, self.env, 3000, "q", False,
            run=commands, search=self.search, now=Ticks(0, 1, 1, 2),
        )  # fmt: skip
        self.assertEqual([call[0] for call in commands.calls], [["make", "run"]])

    def test_a_failing_step_stops_before_the_search(self):
        with self.assertRaisesRegex(RuntimeError, "^make run failed in the clean copy$"):
            judge_path(
                self.clone, self.env, 3000, "q", True,
                run=Commands(failing="run"), search=self.search, now=Ticks(0, 1, 1, 2),
            )  # fmt: skip
        self.assertEqual(self.searches, [])


class ReportTest(unittest.TestCase):
    def test_one_line_per_step_a_total_and_the_search(self):
        steps = [Step("fetch", 12.5), Step("run", 87.5), Step("search", 0.25)]
        self.assertEqual(
            report(steps, "diabetes technology", RESPONSE),
            "fetch     12.5 s\n"
            "run       87.5 s\n"
            "search     0.2 s\n"
            "total    100.2 s\n"
            "search  2 results, abstained False, query 'diabetes technology'",
        )


class CommittableFilesTest(unittest.TestCase):
    def test_tracked_and_untracked_files_but_never_ignored_ones(self):
        repo = Path(tempfile.mkdtemp())
        subprocess.run(["git", "init", "-q"], cwd=repo, check=True)
        (repo / ".gitignore").write_text(".env\ndata/\n")
        (repo / "Makefile").write_text("run:\n")
        subprocess.run(["git", "add", "Makefile", ".gitignore"], cwd=repo, check=True)
        (repo / "infra").mkdir()
        (repo / "infra" / "new.py").write_text("")
        (repo / ".env").write_text("LLM_API_KEY=invented\n")
        (repo / "data").mkdir()
        (repo / "data" / "pages.jsonl").write_text("{}\n")
        self.assertEqual(committable_files(repo), [".gitignore", "Makefile", "infra/new.py"])


if __name__ == "__main__":
    unittest.main()

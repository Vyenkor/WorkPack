import unittest
from pathlib import Path


INDEX = (Path(__file__).resolve().parents[1] / "src" / "main" / "index.ts").read_text(encoding="utf-8")


class SingleInstanceTest(unittest.TestCase):
    def test_second_instance_quits_before_opening_the_database(self):
        lock = INDEX.index("app.requestSingleInstanceLock()")
        quit_without_lock = INDEX.index("if (!hasInstanceLock)", lock)
        database = INDEX.index("new WorkPackService", quit_without_lock)
        self.assertLess(lock, quit_without_lock)
        self.assertLess(quit_without_lock, database)
        self.assertIn("app.quit()", INDEX[quit_without_lock:database])
        self.assertIn("second-instance", INDEX)
        self.assertIn("window.focus()", INDEX)


if __name__ == "__main__":
    unittest.main()

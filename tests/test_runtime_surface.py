from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
MAIN = (ROOT / "src/main/index.ts").read_text(encoding="utf-8")
PRELOAD = (ROOT / "src/preload/index.ts").read_text(encoding="utf-8")
SERVICE = (ROOT / "src/main/service.ts").read_text(encoding="utf-8")
MODEL = (ROOT / "src/shared/model.ts").read_text(encoding="utf-8")


class RuntimeSurfaceTest(unittest.TestCase):
    def test_preload_methods_all_have_main_process_handlers(self):
        registered = set(re.findall(r"handle\('([^']+)'", MAIN))
        exposed = set(re.findall(r"call\('([^']+)'", PRELOAD))
        self.assertEqual(exposed, registered)

    def test_retired_workflow_and_status_api_is_not_shipped(self):
        for source in (MAIN, PRELOAD, MODEL, SERVICE):
            for obsolete in ("saveTemplate", "importTemplates", "completeItem", "completeEvent", "setStatus", "RulesEditor"):
                with self.subTest(obsolete=obsolete):
                    self.assertNotIn(obsolete, source)
        self.assertNotIn("workpack.sqlite'", SERVICE)
        self.assertNotIn('workpack.sqlite"', SERVICE)


if __name__ == "__main__":
    unittest.main()

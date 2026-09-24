from pathlib import Path
import unittest


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
EXPECTED_AGENT_CONTENT = (
    "注意事项：\n"
    "每次改动完成之后，都必须创建一个对应的git commit，以便后续追踪和回溯；\n"
    "每次完成改动之后，都必须编写或更新相关测试，并在交付给用户前，确保所有测试和验证全部通过\n"
    "涉及界面、样式或交互的修改，必须先阅读并遵循根目录的 DESIGN.md；规范中标注为“规划”的交互尚未实现，不能当作现有行为\n"
)


class AgentPolicyTest(unittest.TestCase):
    def test_agent_file_matches_requested_policy(self):
        actual = (REPOSITORY_ROOT / "AGENT.md").read_text(encoding="utf-8")
        self.assertEqual(actual, EXPECTED_AGENT_CONTENT)


if __name__ == "__main__":
    unittest.main()

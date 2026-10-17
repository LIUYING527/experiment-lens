import importlib.util
import pathlib
import unittest

HOOK_PATH = pathlib.Path(__file__).with_name("hook.py")
SPEC = importlib.util.spec_from_file_location("experiment_lens_claude_hook", HOOK_PATH)
HOOK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(HOOK)


class ClaudeCodeHookTests(unittest.TestCase):
    def test_tool_event_uses_stable_session_id_and_metadata_only(self):
        payload = {
            "hook_event_name": "PreToolUse",
            "session_id": "session-123",
            "cwd": "/workspace/demo",
            "tool_name": "Bash",
            "tool_input": {"command": "echo private-data", "description": "secret"},
        }
        event = HOOK.build_event(payload)
        self.assertEqual(event["type"], "agent_tool_start")
        self.assertEqual(event["run_id"], HOOK.build_event(payload)["run_id"])
        self.assertEqual(event["run_name"], "demo")
        self.assertEqual(event["data"]["tool_name"], "Bash")
        self.assertEqual(event["data"]["tool_input_keys"], ["command", "description"])
        self.assertNotIn("private-data", str(event))
        self.assertNotIn("secret", str(event))

    def test_session_end_marks_run_completed(self):
        event = HOOK.build_event({"hook_event_name": "SessionEnd", "session_id": "abc"})
        self.assertEqual(event["type"], "run_end")
        self.assertEqual(event["data"]["status"], "completed")

    def test_unknown_hook_is_preserved(self):
        event = HOOK.build_event({"hook_event_name": "FutureHook", "session_id": "abc"})
        self.assertEqual(event["type"], "agent_hook")
        self.assertEqual(event["data"]["hook"], "FutureHook")


if __name__ == "__main__":
    unittest.main()

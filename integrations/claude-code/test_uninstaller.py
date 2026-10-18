import importlib.util
import json
import pathlib
import tempfile
import unittest

UNINSTALLER_PATH = pathlib.Path(__file__).with_name("uninstall_hooks.py")
SPEC = importlib.util.spec_from_file_location("experiment_lens_hook_uninstaller", UNINSTALLER_PATH)
UNINSTALLER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(UNINSTALLER)


class HookUninstallerTests(unittest.TestCase):
    def test_uninstall_removes_only_experiment_lens_hook_commands(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            project = root / "project"
            hook_path = root / "hook.py"
            hook_path.write_text("# hook", encoding="utf-8")
            settings_dir = project / ".claude"
            settings_dir.mkdir(parents=True)
            settings_path = settings_dir / "settings.local.json"
            settings_path.write_text(json.dumps({
                "permissions": {"allow": ["Bash"]},
                "hooks": {
                    "PreToolUse": [
                        {"matcher": ".*", "hooks": [
                            {"type": "command", "command": f'"python" "{hook_path.resolve()}"'},
                            {"type": "command", "command": "echo keep me"}
                        ]}
                    ],
                    "Notification": [{"hooks": [{"type": "command", "command": "echo existing"}]}]
                }
            }), encoding="utf-8")

            UNINSTALLER.uninstall(project, hook_path)
            result = json.loads(settings_path.read_text(encoding="utf-8"))
            self.assertEqual(result["permissions"]["allow"], ["Bash"])
            self.assertEqual(result["hooks"]["PreToolUse"][0]["hooks"], [{"type": "command", "command": "echo keep me"}])
            self.assertEqual(result["hooks"]["Notification"][0]["hooks"][0]["command"], "echo existing")
            self.assertTrue((settings_dir / "settings.local.json.experiment-lens-uninstall.bak").exists())

            UNINSTALLER.uninstall(project, hook_path)
            self.assertEqual(json.loads(settings_path.read_text(encoding="utf-8")), result)

    def test_uninstall_removes_empty_experiment_lens_hook_groups(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            project = root / "project"
            hook_path = root / "hook.py"
            settings_dir = project / ".claude"
            settings_dir.mkdir(parents=True)
            settings_path = settings_dir / "settings.local.json"
            settings_path.write_text(json.dumps({
                "hooks": {"SessionStart": [{"hooks": [{"type": "command", "command": f'"python" "{hook_path.resolve()}"'}]}]}
            }), encoding="utf-8")
            UNINSTALLER.uninstall(project, hook_path)
            self.assertEqual(json.loads(settings_path.read_text(encoding="utf-8")), {})


if __name__ == "__main__":
    unittest.main()

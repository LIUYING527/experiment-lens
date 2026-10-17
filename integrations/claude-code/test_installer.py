import importlib.util
import json
import pathlib
import tempfile
import unittest

INSTALLER_PATH = pathlib.Path(__file__).with_name("install_hooks.py")
SPEC = importlib.util.spec_from_file_location("experiment_lens_hook_installer", INSTALLER_PATH)
INSTALLER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(INSTALLER)


class HookInstallerTests(unittest.TestCase):
    def test_install_preserves_settings_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as tmp:
            project = pathlib.Path(tmp) / "project"
            settings_dir = project / ".claude"
            settings_dir.mkdir(parents=True)
            settings_path = settings_dir / "settings.local.json"
            settings_path.write_text(json.dumps({
                "permissions": {"allow": ["Bash"]},
                "hooks": {"Notification": [{"hooks": [{"type": "command", "command": "echo existing"}]}]},
            }), encoding="utf-8")
            hook_path = pathlib.Path(tmp) / "hook.py"
            hook_path.write_text("# hook", encoding="utf-8")

            INSTALLER.install(project, hook_path, python_executable="python-test")
            first = json.loads(settings_path.read_text(encoding="utf-8"))
            self.assertEqual(first["permissions"]["allow"], ["Bash"])
            self.assertEqual(first["hooks"]["Notification"][0]["hooks"][0]["command"], "echo existing")
            self.assertTrue((settings_dir / "settings.local.json.experiment-lens.bak").exists())
            counts = {name: len(entries) for name, entries in first["hooks"].items()}

            INSTALLER.install(project, hook_path, python_executable="python-test")
            second = json.loads(settings_path.read_text(encoding="utf-8"))
            self.assertEqual(counts, {name: len(entries) for name, entries in second["hooks"].items()})

    def test_invalid_hooks_shape_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            project = pathlib.Path(tmp)
            settings_dir = project / ".claude"
            settings_dir.mkdir()
            (settings_dir / "settings.local.json").write_text('{"hooks": []}', encoding="utf-8")
            with self.assertRaises(ValueError):
                INSTALLER.install(project, pathlib.Path(tmp) / "hook.py", python_executable="python-test")


if __name__ == "__main__":
    unittest.main()

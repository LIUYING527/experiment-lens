"""Install Experiment Lens hooks into a Claude Code project's local settings.

Usage:
  python integrations/claude-code/install_hooks.py --project D:\\path\\to\\your-project

The installer preserves unrelated settings and hooks, creates a backup before
changing an existing settings file, and is safe to run more than once.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from pathlib import Path
from typing import Any, Dict, List

HOOK_EVENTS = {
    "SessionStart": False,
    "SessionEnd": False,
    "UserPromptSubmit": False,
    "PreToolUse": True,
    "PostToolUse": True,
    "PostToolUseFailure": True,
    "Notification": False,
    "SubagentStart": False,
    "SubagentStop": False,
    "Stop": False,
}


def command_for(hook_path: Path, python_executable: str) -> str:
    # JSON serialization handles Windows backslashes in the settings file.
    # The command itself is a shell command, so quote both executable paths.
    return '"{}" "{}"'.format(python_executable, str(hook_path.resolve()))


def install(project: Path, hook_path: Path, python_executable: str = sys.executable) -> Path:
    project = project.expanduser().resolve()
    settings_dir = project / ".claude"
    settings_path = settings_dir / "settings.local.json"
    settings_dir.mkdir(parents=True, exist_ok=True)

    settings: Dict[str, Any] = {}
    if settings_path.exists():
        try:
            loaded = json.loads(settings_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise ValueError(f"Cannot read existing settings file {settings_path}: {error}") from error
        if not isinstance(loaded, dict):
            raise ValueError(f"Expected a JSON object in {settings_path}")
        settings = loaded

    hooks = settings.setdefault("hooks", {})
    if not isinstance(hooks, dict):
        raise ValueError(f"'hooks' must be a JSON object in {settings_path}")

    command = command_for(hook_path, python_executable)
    changed = False
    for event_name, needs_matcher in HOOK_EVENTS.items():
        entries = hooks.setdefault(event_name, [])
        if not isinstance(entries, list):
            raise ValueError(f"hooks.{event_name} must be a JSON array in {settings_path}")

        # Do not duplicate our command when the installer is run repeatedly.
        already_installed = any(
            isinstance(entry, dict)
            and isinstance(entry.get("hooks"), list)
            and any(isinstance(item, dict) and item.get("type") == "command" and item.get("command") == command
                    for item in entry["hooks"])
            for entry in entries
        )
        if already_installed:
            continue

        entry: Dict[str, Any] = {"hooks": [{"type": "command", "command": command}]}
        if needs_matcher:
            entry["matcher"] = ".*"
        entries.append(entry)
        changed = True

    if changed:
        if settings_path.exists():
            backup = settings_path.with_suffix(settings_path.suffix + ".experiment-lens.bak")
            if not backup.exists():
                shutil.copy2(settings_path, backup)
        temp_path = settings_path.with_suffix(settings_path.suffix + ".tmp")
        temp_path.write_text(json.dumps(settings, indent=2, ensure_ascii=False) + os.linesep, encoding="utf-8")
        temp_path.replace(settings_path)
    return settings_path


def main() -> int:
    parser = argparse.ArgumentParser(description="Install Experiment Lens hooks into a Claude Code project.")
    parser.add_argument("--project", type=Path, default=Path.cwd(), help="Target project directory (default: current directory)")
    parser.add_argument("--hook-path", type=Path, default=Path(__file__).with_name("hook.py"), help="Path to hook.py")
    args = parser.parse_args()
    try:
        settings_path = install(args.project, args.hook_path)
    except (OSError, ValueError) as error:
        print(f"Experiment Lens hook installer: {error}", file=sys.stderr)
        return 1
    print(f"Claude Code hooks configured in: {settings_path}")
    print("Restart Claude Code in that project. Existing settings were preserved.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

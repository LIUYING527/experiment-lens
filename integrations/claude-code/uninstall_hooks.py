"""Remove only Experiment Lens hooks from a Claude Code project's local settings.

Usage:
  python integrations/claude-code/uninstall_hooks.py --project D:\\path\\to\\your-project
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from pathlib import Path
from typing import Any, Dict

def uninstall(project: Path, hook_path: Path) -> Path:
    project = project.expanduser().resolve()
    settings_path = project / ".claude" / "settings.local.json"
    if not settings_path.exists():
        return settings_path

    try:
        settings = json.loads(settings_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"Cannot read settings file {settings_path}: {error}") from error
    if not isinstance(settings, dict):
        raise ValueError(f"Expected a JSON object in {settings_path}")

    hooks = settings.get("hooks")
    if hooks is None:
        return settings_path
    if not isinstance(hooks, dict):
        raise ValueError(f"'hooks' must be a JSON object in {settings_path}")

    target = str(hook_path.expanduser().resolve())
    changed = False
    for event_name, entries in list(hooks.items()):
        if not isinstance(entries, list):
            continue
        kept_entries = []
        for entry in entries:
            if not isinstance(entry, dict) or not isinstance(entry.get("hooks"), list):
                kept_entries.append(entry)
                continue
            kept_hooks = [
                item for item in entry["hooks"]
                if not (
                    isinstance(item, dict)
                    and item.get("type") == "command"
                    and isinstance(item.get("command"), str)
                    and target in item["command"]
                )
            ]
            if len(kept_hooks) != len(entry["hooks"]):
                changed = True
            if kept_hooks:
                kept_entry = dict(entry)
                kept_entry["hooks"] = kept_hooks
                kept_entries.append(kept_entry)
            elif not entry["hooks"]:
                kept_entries.append(entry)
        if kept_entries:
            hooks[event_name] = kept_entries
        elif entries:
            hooks.pop(event_name, None)
            changed = True
        else:
            hooks[event_name] = entries

    if not hooks and changed:
        settings.pop("hooks", None)

    if changed:
        backup = settings_path.with_suffix(settings_path.suffix + ".experiment-lens-uninstall.bak")
        if not backup.exists():
            shutil.copy2(settings_path, backup)
        temp_path = settings_path.with_suffix(settings_path.suffix + ".tmp")
        temp_path.write_text(json.dumps(settings, indent=2, ensure_ascii=False) + os.linesep, encoding="utf-8")
        temp_path.replace(settings_path)
    return settings_path

def main() -> int:
    parser = argparse.ArgumentParser(description="Remove Experiment Lens hooks from a Claude Code project.")
    parser.add_argument("--project", type=Path, default=Path.cwd(), help="Target project directory (default: current directory)")
    parser.add_argument("--hook-path", type=Path, default=Path(__file__).with_name("hook.py"), help="Path to the installed hook.py")
    args = parser.parse_args()
    try:
        settings_path = uninstall(args.project, args.hook_path)
    except (OSError, ValueError) as error:
        print(f"Experiment Lens hook uninstaller: {error}", file=sys.stderr)
        return 1
    print(f"Experiment Lens hooks removed from: {settings_path}")
    print("Unrelated settings and hooks were preserved.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

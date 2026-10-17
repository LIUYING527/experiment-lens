"""Claude Code hook adapter for Experiment Lens.

Configure this script as a Claude Code hook command. It reads the hook payload
from stdin and sends metadata-only events to the local Experiment Lens viewer.
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict

BASE_URL = os.environ.get("EXPERIMENT_LENS_URL", "http://127.0.0.1:7337").rstrip("/")
EVENT_MAP = {
    "SessionStart": "run_start",
    "SessionEnd": "run_end",
    "UserPromptSubmit": "agent_prompt_submitted",
    "PreToolUse": "agent_tool_start",
    "PostToolUse": "agent_tool_end",
    "PostToolUseFailure": "agent_tool_error",
    "Notification": "agent_notification",
    "Stop": "agent_turn_end",
    "SubagentStart": "agent_subagent_start",
    "SubagentStop": "agent_subagent_end",
}


def build_event(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Convert one Claude Code hook payload into a privacy-conscious event."""
    hook_name = str(payload.get("hook_event_name") or "ClaudeCodeHook")
    session = str(payload.get("session_id") or payload.get("transcript_path") or payload.get("cwd") or "default-session")
    run_id = hashlib.sha256(session.encode("utf-8")).hexdigest()[:12]
    cwd = str(payload.get("cwd") or "")
    run_name = Path(cwd).name if cwd else "Claude Code"
    tool_name = payload.get("tool_name")
    tool_input = payload.get("tool_input")
    tool_response = payload.get("tool_response")
    data: Dict[str, Any] = {
        "source": "claude-code",
        "hook": hook_name,
        "cwd": cwd,
    }
    if tool_name:
        data["tool_name"] = str(tool_name)
    if isinstance(tool_input, dict):
        # Do not forward tool arguments or prompt text; key names are enough to
        # show the shape of an operation without copying potentially sensitive data.
        data["tool_input_keys"] = sorted(str(key) for key in tool_input.keys())[:40]
    if tool_response is not None:
        data["tool_response_type"] = type(tool_response).__name__
        try:
            data["tool_response_chars"] = len(json.dumps(tool_response, ensure_ascii=False))
        except (TypeError, ValueError):
            data["tool_response_chars"] = 0
    if payload.get("notification_type"):
        data["notification_type"] = str(payload["notification_type"])
    if payload.get("reason"):
        data["reason"] = str(payload["reason"])[:160]

    event: Dict[str, Any] = {
        "id": f"{run_id}-{time.time_ns()}",
        "ts": time.time(),
        "run_id": run_id,
        "run_name": run_name,
        "type": EVENT_MAP.get(hook_name, "agent_hook"),
        "data": data,
    }
    if hook_name == "SessionStart":
        event["data"]["status"] = "running"
    elif hook_name == "SessionEnd":
        event["data"]["status"] = "completed"
    elif hook_name == "PostToolUseFailure":
        event["data"]["status"] = "error"
    return event


def main() -> int:
    try:
        payload = json.load(sys.stdin)
        if not isinstance(payload, dict):
            raise ValueError("Expected a JSON object from Claude Code hook stdin")
        event = build_event(payload)
        request = urllib.request.Request(
            BASE_URL + "/events",
            data=json.dumps(event).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=1.0) as response:
            return 0 if 200 <= response.status < 300 else 1
    except (ValueError, json.JSONDecodeError) as error:
        print(f"Experiment Lens Claude Code hook: invalid input: {error}", file=sys.stderr)
        return 2
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        print(f"Experiment Lens Claude Code hook: cannot reach viewer at {BASE_URL}: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

# Experiment Lens

**A real-time observation window for AI agent workflows and experiments.**

Experiment Lens is a Windows-first, local-first desktop viewer for observing long-running agent workflows and experiments without requiring agents to write custom visualization code. It is designed to be domain-neutral: coding agents, data pipelines, robotics, and model evaluations can all emit events into the same viewer.

## What the MVP shows

- Live event stream and run status
- Metrics and action events
- Image artifacts sent as data URLs
- Optional 2D trajectory points
- Local HTTP event endpoint and WebSocket stream
- Persistent local event history (restores the latest 3,000 events after restart)

## Architecture

```text
Agent / Experiment
       |  Python SDK (HTTP)
       v
Local Event Server (127.0.0.1:7337)
       |  WebSocket /stream
       v
Electron Desktop Viewer
```

## Quick start (Windows, macOS, Linux)

You need Node.js 18+ and Python 3.9+.

### 1. Start the desktop viewer

```powershell
cd viewer
npm install
npm start
```

The viewer opens a desktop window and listens locally at `http://127.0.0.1:7337`. The server binds to `127.0.0.1` rather than a public network interface and rejects requests carrying non-local browser origins. The dashboard applies a restrictive Content Security Policy. Recent events are stored as JSON Lines in Electron's app-specific user-data directory and restored on the next launch; the viewer keeps at most 3,000 events in its active history.

### 2. Install the Python SDK

In a second terminal from the repository root:

```powershell
python -m pip install -e ./sdk/python
```

### 3. Send demo events

```powershell
python -m pip install -e ./sdk/python
python examples/vln_demo.py
```

The demo emits synthetic metrics, actions, and trajectory points. It does not run a real navigation benchmark.

## SDK example

```python
from experiment_lens import Lens

lens = Lens(run_name="my-agent-run")
lens.metric("reward", 0.82)
lens.action("tool_call", tool="search")
lens.step(step=1, message="First step complete")
lens.end_run(status="completed")
```

The SDK is intentionally dependency-free and fails silently by default if the viewer is not running; pass `fail_silently=False` to surface connection errors.

## Development checks

The repository includes a GitHub Actions workflow that runs Python SDK unit tests on Python 3.9, 3.11, and 3.12, compiles the demo, installs the viewer dependencies, and checks the viewer JavaScript syntax. Run the SDK tests locally with:

```powershell
python -m pip install -e ./sdk/python
cd sdk/python
python -m unittest discover -s tests -v
```

Run the viewer syntax check from the `viewer` directory with `npm run check`, and its event-store/security tests with `npm test`. Build a Windows x64 installer locally with `npm run dist:win` (requires `npm install` first). The Windows Installer workflow also runs on demand from GitHub Actions and on version tags.


## Claude Code integration (experimental)

The first agent adapter observes Claude Code lifecycle and tool-use hooks. It sends metadata-only events to the local viewer: it does **not** forward prompt text, tool arguments, or tool output contents. It does record tool names, input key names, working directory, hook type, and output size metadata.

1. Start Experiment Lens (`cd viewer; npm start`).
2. Confirm Python is available in PowerShell (`python --version`). The hook adapter uses only Python's standard library.
3. Install hooks into the Claude Code project you want to observe. From the Experiment Lens repository root, run the installer and pass your target project directory:

   ```powershell
   python .\\integrations\\claude-code\\install_hooks.py --project "D:\\path\\to\\your\\project"
   ```

   Replace the project path with the directory where you run Claude Code. The installer merges hooks into `.claude/settings.local.json`, preserves unrelated settings, creates a one-time backup before editing an existing file, and avoids adding duplicate commands if rerun. Review the resulting settings before using it. It does not modify global Claude Code settings.

   The hook adapter reads Claude Code's JSON payload from stdin. To use a different local viewer endpoint, set `EXPERIMENT_LENS_URL` before launching Claude Code (default: `http://127.0.0.1:7337`).

4. Restart Claude Code in that project and use it normally. Hook events should appear in Experiment Lens under a session-based run. If the command fails, check the Claude Code hook diagnostics and verify that the viewer is running.

The adapter is experimental; hook event names and payloads can vary by Claude Code version. Its event mapping has unit tests, but should be validated against the installed Claude Code version before relying on it for important work.

## Current status and limitations

This is an early MVP, not a production release. The first milestone is a working end-to-end loop from emitted events to a live desktop dashboard. The viewer persists recent events locally and restores up to 3,000 events after restart. Large image `data_url` payloads are intentionally omitted from persisted history (the live preview still works while the event is streaming) to keep local storage bounded. Run History groups events by run ID, supports text filtering, lets you step or play through recorded events, and compares two runs side by side using event counts, duration, tool activity, error-like events, and metric counts. You can export the current local event history as JSON for debugging or sharing a reproducible report. Replay is a read-only inspection of recorded event metadata, not a rerun of the agent. The trajectory view expects simple 2D point arrays such as `[[x, y], ...]`; run comparison, richer media, and additional agent adapters remain follow-up work. End-to-end behavior still needs to be tested on a clean Windows machine.

## Contributing

Issues and pull requests are welcome. Please include reproduction steps and your environment details when reporting bugs.

## License

MIT. See [LICENSE](LICENSE).

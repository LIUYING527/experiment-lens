# Experiment Lens

**A real-time observation window for AI agent workflows and experiments.**

Experiment Lens is a Windows-first, local-first desktop viewer for observing long-running agent workflows and experiments without requiring agents to write custom visualization code. It is designed to be domain-neutral: coding agents, data pipelines, robotics, and model evaluations can all emit events into the same viewer.

[![CI](https://github.com/LIUYING527/experiment-lens/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/LIUYING527/experiment-lens/actions/workflows/ci.yml)
[![Windows installer](https://github.com/LIUYING527/experiment-lens/actions/workflows/windows-installer.yml/badge.svg?branch=main)](https://github.com/LIUYING527/experiment-lens/actions/workflows/windows-installer.yml)

## What it does

- Live event stream and run status
- Metrics, action events, tool activity, and errors
- Image previews for live image events
- Optional 2D trajectory points
- Run History grouped by run ID, with text filtering
- Replay controls for stepping or playing through recorded events
- Side-by-side comparison of two runs
- JSON export of the current event history
- Local HTTP event endpoint and WebSocket stream
- Persistent local event history (up to the latest 3,000 events)

## Architecture

```text
Agent / Experiment
       | Python SDK or adapter
       v
Local Event Server (127.0.0.1:7337)
       | WebSocket /stream
       v
Electron Desktop Viewer
```

## Quick start

You need Node.js 18+ and Python 3.9+.

### 1. Start the desktop viewer

From the repository root:

```powershell
cd viewer
npm install
npm start
```

The viewer opens a desktop window and listens locally at `http://127.0.0.1:7337`. The server binds to loopback rather than a public network interface and rejects requests carrying non-local browser origins. The dashboard applies a restrictive Content Security Policy.

### 2. Install the Python SDK

From the repository root, in a second terminal:

```powershell
python -m pip install -e ./sdk/python
```

### 3. Send demo events

```powershell
python examples/vln_demo.py
```

The demo emits synthetic metrics, actions, and trajectory points. It does not run a real navigation benchmark.

### Windows installer

The Windows x64 NSIS installer is built by GitHub Actions. Open the [Windows installer workflow](https://github.com/LIUYING527/experiment-lens/actions/workflows/windows-installer.yml), select a successful run, and download the `experiment-lens-windows-installer` artifact. Workflow artifacts expire after 14 days, so they are for testing rather than permanent distribution. A versioned GitHub Release will be used for stable downloads after the 1.0 release gates are met.

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

## Claude Code integration (experimental)

The first agent adapter observes Claude Code lifecycle and tool-use hooks. It sends metadata-only events to the local viewer: it does **not** forward prompt text, tool argument values, or tool output contents. It can record metadata such as tool names, input key names, working directory, hook type, and output size.

1. Start Experiment Lens (`cd viewer; npm start`).
2. Confirm Python is available in PowerShell (`python --version`).
3. From the Experiment Lens repository root, install hooks into the project where you run Claude Code:

   ```powershell
   python .\integrations\claude-code\install_hooks.py --project "D:\path\to\your\project"
   ```

   To remove only Experiment Lens hooks later:

   ```powershell
   python .\integrations\claude-code\uninstall_hooks.py --project "D:\path\to\your\project"
   ```

   Replace the example path with your project directory. The installer updates that project's `.claude/settings.local.json`, preserves unrelated settings and hooks, creates a backup before editing an existing file, and avoids adding duplicate commands when rerun. It does not modify global Claude Code settings. Review the resulting settings before using it.

4. Restart Claude Code in that project and use it normally. Hook events should appear in Experiment Lens under a session-based run. If events do not appear, check the Claude Code hook diagnostics and confirm the viewer is running.

The adapter is experimental. Hook event names and payloads can vary by Claude Code version; its event mapping and install/uninstall behavior have unit tests, but the full integration should be validated against the installed Claude Code version.

## Data handling and limitations

- The viewer stores recent event history locally as JSON Lines in Electron's app-specific user-data directory and restores up to 3,000 events after restart.
- Large image `data_url` payloads are intentionally omitted from persisted history and JSON exports to keep storage bounded. A live image preview can still update while the event is streaming.
- Replay is read-only inspection of recorded events; it does not rerun the agent.
- The trajectory view expects simple 2D point arrays such as `[[x, y], ...]`.
- The Claude Code adapter is metadata-only by design, but users should review the event schema and local settings before using it with sensitive projects.
- A successful automated build does not replace a clean-machine Windows acceptance test. Installer startup, SDK-to-viewer behavior, and the installed Claude Code hook chain remain part of final release acceptance.

## Development checks

GitHub Actions runs Python SDK unit tests on Python 3.9, 3.11, and 3.12, Claude Code adapter tests, JavaScript syntax checks, and viewer logic tests.

Run the SDK tests locally:

```powershell
python -m pip install -e ./sdk/python
cd sdk/python
python -m unittest discover -s tests -v
```

Run viewer checks from the `viewer` directory:

```powershell
npm run check
npm test
```

Build a Windows x64 installer locally with `npm run dist:win` after `npm install`.

## Project docs

- [Architecture and event contract](docs/ARCHITECTURE.md)
- [Troubleshooting guide](docs/TROUBLESHOOTING.md)
- [1.0 release readiness checklist](docs/RELEASE_CHECKLIST.md)

## Contributing

Issues and pull requests are welcome. Please include reproduction steps and your environment details when reporting bugs.

## License

MIT. See [LICENSE](LICENSE).

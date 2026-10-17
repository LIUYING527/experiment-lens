# Experiment Lens

**A real-time observation window for AI agent workflows and experiments.**

Experiment Lens is a Windows-first, local-first desktop viewer for observing long-running agent workflows and experiments without requiring agents to write custom visualization code. It is designed to be domain-neutral: coding agents, data pipelines, robotics, and model evaluations can all emit events into the same viewer.

## What the MVP shows

- Live event stream and run status
- Metrics and action events
- Image artifacts sent as data URLs
- Optional 2D trajectory points
- Local HTTP event endpoint and WebSocket stream

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

The viewer opens a desktop window and listens locally at `http://127.0.0.1:7337`. The server binds to `127.0.0.1` rather than a public network interface.

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

Run the viewer syntax check from the `viewer` directory with `npm run check`.

## Current status and limitations

This is an early MVP, not a production release. The first milestone is a working end-to-end loop from emitted events to a live desktop dashboard. The current viewer keeps events in memory, so history is lost when the app closes. The trajectory view expects simple 2D point arrays such as `[[x, y], ...]`; persistence, replay, run comparison, richer media, and additional agent adapters are follow-up work. End-to-end behavior still needs to be tested on a clean Windows machine.

## Contributing

Issues and pull requests are welcome. Please include reproduction steps and your environment details when reporting bugs.

## License

MIT. See [LICENSE](LICENSE).

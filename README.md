# Viziverse

**Visualize anything that happens in your software — live, locally, and in one place.**

Viziverse is a local-first visualization workspace for processes that are difficult to understand from logs alone: AI agents, model training and evaluation, robotics, data pipelines, scripts, simulations, benchmarks, and custom applications.

Instead of building a separate dashboard for every use case, Viziverse aims to provide one event protocol, a flexible collection layer, and scene-specific views that turn live activity into something people can inspect and understand.

> **Current status:** early development. The existing desktop viewer and Python SDK are the foundation; the universal adapter and visualization-plugin architecture are the direction of travel, not features that are all complete today.

[![CI](https://github.com/LIUYING527/experiment-lens/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/LIUYING527/experiment-lens/actions/workflows/ci.yml)
[![Windows installer](https://github.com/LIUYING527/experiment-lens/actions/workflows/windows-installer.yml/badge.svg?branch=main)](https://github.com/LIUYING527/experiment-lens/actions/workflows/windows-installer.yml)

## The idea

**One observation layer. Many kinds of work. The right view for each one.**

Viziverse is not intended to be another dashboard that only shows generic charts. Different processes need different visual forms:

- **AI agents:** execution timeline, tool calls, errors, run replay, and multi-step state.
- **Model training and evaluation:** loss and score curves, checkpoints, dataset splits, and run comparisons.
- **Robotics and simulation:** camera frames, trajectories, spatial state, actions, and episode replay.
- **Data pipelines:** stage graphs, throughput, queue depth, retries, and failed records.
- **Scripts and applications:** logs, progress, structured events, resource metrics, and artifacts.
- **Custom domains:** user-defined events, views, and adapters.

The goal is to make the common path effortless while keeping domain-specific views possible through extensions.

## What works today

- Windows-first Electron desktop viewer with a local HTTP/WebSocket event service.
- Lightweight Python SDK for runs, events, metrics, images, actions, goals, and trajectories.
- Live numeric training/evaluation curves grouped by metric and split.
- CSV, JSONL, NDJSON, and TensorBoard scalar CSV log import, including incremental watch mode.
- Run history, event filtering, read-only replay, two-run comparison, and JSON export.
- Image previews and a basic 2D trajectory view.
- Optional metadata-only Claude Code hook integration.
- Bounded local event history and local-networking protections.

These are the current capabilities, not a claim that every scenario is already automatically detected or perfectly visualized.

## Quick start

Requirements: Node.js 22+ and Python 3.9+.

### 1. Start the desktop viewer

\`\`\`powershell
cd viewer
npm install
npm start
\`\`\`

The viewer opens a desktop window and listens on \`http://127.0.0.1:7337\`. The local service binds to loopback rather than a public network interface.

### 2. Install the Python SDK

From the repository root, in another terminal:

\`\`\`powershell
python -m pip install -e ./sdk/python
\`\`\`

The distribution and import paths remain \`experiment-lens\` / \`experiment_lens\` for compatibility during the rebrand.

### 3. Run an example

\`\`\`powershell
python examples/vln_demo.py
python examples/training_demo.py
\`\`\`

The training demo emits synthetic metrics for visualization; it does not train a real model.

## Architecture direction

\`\`\`text
SDKs / framework adapters / log importers / custom event producers
                            |
                            v
                 Canonical event protocol
                            |
                            v
              Local collector + event store
                            |
                            v
             Semantic state / session model
                            |
              +-------------+-------------+
              |             |             |
              v             v             v
        Timeline view   Metric view   Spatial/artifact view
              |             |             |
              +------ extensible view plugins ------+
                            |
                            v
                Local-first desktop workspace
\`\`\`

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/PRODUCT_VISION.md](docs/PRODUCT_VISION.md).

## Design principles

1. **Local-first by default.** Data stays on the user's machine unless they explicitly configure an external destination.
2. **One protocol, many adapters.** Framework-specific integration belongs at the edge; the core should not depend on one AI framework.
3. **Views follow meaning.** Metrics, timelines, graphs, spatial data, images, and artifacts should not all be forced into one generic chart.
4. **Progressive disclosure.** Start with a useful default view, then let users drill into details.
5. **Live and replay share one data model.** A run should be inspectable while it happens and after it finishes.
6. **Extensible, not infinitely magical.** Automatic views handle common schemas; unusual semantics use explicit adapters and plugins.
7. **Privacy and bounded resource use.** Avoid silently capturing secrets or huge binary payloads; keep retention predictable.

## Roadmap

- [x] Local event collection and live desktop viewer
- [x] Python SDK and basic event schema
- [x] Training metric visualization and log import
- [x] Run history, replay, comparison, and JSON export
- [ ] Version and document a stable canonical event protocol
- [ ] Separate ingestion, normalization, semantic state, and rendering contracts
- [ ] Add pluggable view definitions and reusable scene templates
- [ ] Add adapters for agent, ML, robotics, and pipeline workflows
- [ ] Add schema discovery and a first-run suggested-view experience
- [ ] Improve high-volume rendering, filtering, and time navigation
- [ ] Release a polished 1.0 with tested installers and migration documentation

## Project name

The product name is **Viziverse** and the tagline is **Visualize anything**. The GitHub repository and Python distribution still use their existing \`experiment-lens\` names while compatibility and repository settings are migrated deliberately.

## Contributing

Issues and pull requests are welcome. Useful contributions include real-world event samples, framework adapters, view plugins, accessibility improvements, and reproducible performance tests. See [CHANGELOG.md](CHANGELOG.md).

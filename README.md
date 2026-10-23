# Experiment Lens

**A local-first desktop observability workspace for agent workflows, model training, and evaluation.**

Experiment Lens is a Windows-first, local-first desktop viewer inspired by always-available agent observation tools. It combines live agent activity with training curves and validation metrics, so researchers can watch long-running experiments as they train and evaluate. Coding agents, robotics, reinforcement learning, fine-tuning jobs, and custom evaluation scripts can emit structured events through the same lightweight Python SDK.

[![CI](https://github.com/LIUYING527/experiment-lens/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/LIUYING527/experiment-lens/actions/workflows/ci.yml)
[![Windows installer](https://github.com/LIUYING527/experiment-lens/actions/workflows/windows-installer.yml/badge.svg?branch=main)](https://github.com/LIUYING527/experiment-lens/actions/workflows/windows-installer.yml)

## What it does

- Live event stream and run status
- Live train/validation metric curves grouped by metric and split
- Training and evaluation metrics indexed by epoch, step, or event time
- Overlay curves from recent experiment runs for quick comparisons
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

\`\`\`text
Agent / Training Process / Existing Log
       | Python SDK / CSV & JSONL importer
       v
Local Event Server (127.0.0.1:7337)
       | WebSocket /stream
       v
Experiment Lens Desktop Viewer
\`\`\`

## Quick start

You need Node.js 22+ and Python 3.9+. The Windows installer workflow uses Node.js 22.

### 1. Start the desktop viewer

From the repository root:

\`\`\`powershell
cd viewer
npm install
npm start
\`\`\`

The viewer opens a desktop window and listens locally at \`http://127.0.0.1:7337\`. The server binds to loopback rather than a public network interface and rejects requests carrying non-local browser origins. The dashboard applies a restrictive Content Security Policy.

### 2. Install the Python SDK

From the repository root, in a second terminal:

\`\`\`powershell
python -m pip install -e ./sdk/python
\`\`\`

### 3. Send demo events

For agent/navigation-style events:

\`\`\`powershell
python examples/vln_demo.py
\`\`\`

For training and validation curves:

\`\`\`powershell
python examples/training_demo.py
\`\`\`

The training demo emits **synthetic** train loss, validation loss, and validation accuracy. It does not train a real model. In the dashboard's Training & Evaluation panel, select \`loss\` to overlay training and validation curves, or select \`accuracy\` to inspect validation accuracy.

### Import existing training logs (CSV / JSONL)

You can visualize logs from a training run without editing the training loop. Supported files are CSV, JSONL, and NDJSON. Wide CSV rows such as \`step,epoch,train_loss,eval_loss,eval_accuracy\` are detected automatically; long rows such as \`step,name,value,split\` are also supported. TensorBoard scalar CSV exports (\`Wall time,Step,Value\`, optionally with \`Tag\`) and case-insensitive column names are supported. Prefixes \`train_\`, \`eval_\`, \`validation_\`, \`val_\`, and \`test_\` (also slash-style tags such as \`train/loss\`) map metric names to their data split.

Import a completed log:

\`\`\`powershell
python -m experiment_lens.log_importer .\\logs\\metrics.csv --run-name my-finetune
\`\`\`

Follow a log while it grows (the importer polls for appended rows):

\`\`\`powershell
python -m experiment_lens.log_importer .\\logs\\metrics.jsonl --run-name my-finetune --watch --interval 2
\`\`\`

Keep the desktop viewer running while importing. The importer reads local files and forwards numeric metrics to the local viewer; it does not upload the source log. In watch mode, it notices appended rows and resets its cursor if the file is truncated or rotated.

### Windows installer

The Windows x64 NSIS installer is built by GitHub Actions. Open the [Windows installer workflow](https://github.com/LIUYING527/experiment-lens/actions/workflows/windows-installer.yml), select a successful run, and download the \`experiment-lens-windows-installer\` artifact. Workflow artifacts expire after 14 days, so they are for testing rather than permanent distribution. A versioned GitHub Release will be used for stable downloads after the 1.0 release gates are met.

## SDK example

\`\`\`python
from experiment_lens import Lens

lens = Lens(run_name="my-agent-run")
lens.training_metric("loss", 0.42, step=1200, epoch=3, learning_rate=0.0003)
lens.evaluation_metric("accuracy", 0.91, epoch=3, split="validation")
lens.action("tool_call", tool="search")
lens.step(step=1, message="First step complete")
lens.end_run(status="completed")
\`\`\`

The SDK is intentionally dependency-free and fails silently by default if the viewer is not running; pass \`fail_silently=False\` to surface connection errors.

### Hugging Face Trainer integration

For Hugging Face \`Trainer\` fine-tuning, the optional callback adapter forwards numeric training logs and evaluation metrics without adding a Transformers dependency to the Experiment Lens SDK:

\`\`\`python
from experiment_lens import Lens
from experiment_lens.integrations import HuggingFaceTrainerCallback

lens = Lens(run_name="my-finetune")
trainer.add_callback(HuggingFaceTrainerCallback(lens))
trainer.train()
\`\`\`

Training metrics such as \`loss\` and \`learning_rate\` appear as training series; \`eval_loss\` and \`eval_accuracy\` become validation series. Evaluation updates arrive when the Trainer runs evaluation, so configure its normal evaluation schedule (for example, by steps or epochs) in your training arguments. The callback is intentionally small and can be adapted to other training frameworks.

## Claude Code integration (experimental)

The first agent adapter observes Claude Code lifecycle and tool-use hooks. It sends metadata-only events to the local viewer: it does **not** forward prompt text, tool argument values, or tool output contents. It can record metadata such as tool names, input key names, working directory, hook type, and output size.

1. Start Experiment Lens (\`cd viewer; npm start\`).
2. Confirm Python is available in PowerShell (\`python --version\`).
3. From the Experiment Lens repository root, install hooks into the project where you run Claude Code:

   \`\`\`powershell
   python .\\integrations\\claude-code\\install_hooks.py --project "D:\\path\\to\\your\\project"
   \`\`\`

   To remove only Experiment Lens hooks later:

   \`\`\`powershell
   python .\\integrations\\claude-code\\uninstall_hooks.py --project "D:\\path\\to\\your\\project"
   \`\`\`

   Replace the example path with your project directory. The installer updates that project's \`.claude/settings.local.json\`, preserves unrelated settings and hooks, creates a backup before editing an existing file, and avoids adding duplicate commands when rerun. It does not modify global Claude Code settings. Review the resulting settings before using it.

4. Restart Claude Code in that project and use it normally. Hook events should appear in Experiment Lens under a session-based run. If events do not appear, check the Claude Code hook diagnostics and confirm the viewer is running.

The adapter is experimental. Hook event names and payloads can vary by Claude Code version; its event mapping and install/uninstall behavior have unit tests, but the full integration should be validated against the installed Claude Code version.

## Data handling and limitations

- The viewer stores recent event history locally as JSON Lines in Electron's app-specific user-data directory and restores up to 3,000 events after restart.
- Large image \`data_url\` payloads are intentionally omitted from persisted history and JSON exports to keep storage bounded. A live image preview can still update while the event is streaming.
- Replay is read-only inspection of recorded events; it does not rerun the agent.
- The trajectory view expects simple 2D point arrays such as \`[[x, y], ...]\`.
- Training charts currently use numeric \`metric\` events; use \`Lens.training_metric(...)\` and \`Lens.evaluation_metric(...)\`, the Hugging Face callback, or the CSV/JSONL importer. Metrics update only when your process emits them, so periodic evaluation is supported without continuous per-step reporting.
- The Claude Code adapter is metadata-only by design, but users should review the event schema and local settings before using it with sensitive projects.
- A successful automated build does not replace a clean-machine Windows acceptance test. Installer startup, SDK-to-viewer behavior, and the installed Claude Code hook chain remain part of final release acceptance.

## Development checks

GitHub Actions runs Python SDK unit tests on Python 3.9, 3.11, and 3.12, Claude Code adapter tests, JavaScript syntax checks, and viewer logic tests.

Run the SDK tests locally:

\`\`\`powershell
python -m pip install -e ./sdk/python
cd sdk/python
python -m unittest discover -s tests -v
\`\`\`

Run viewer checks from the \`viewer\` directory:

\`\`\`powershell
npm run check
npm test
\`\`\`

Build a Windows x64 installer locally with \`npm run dist:win\` after \`npm install\`.

## Project docs

- [Architecture and event contract](docs/ARCHITECTURE.md)
- [Troubleshooting guide](docs/TROUBLESHOOTING.md)
- [Security and privacy](SECURITY.md)
- [Changelog](CHANGELOG.md)
- [1.0 release readiness checklist](docs/RELEASE_CHECKLIST.md)

## Contributing

Issues and pull requests are welcome. Please include reproduction steps and your environment details when reporting bugs.

## License

MIT. See [LICENSE](LICENSE).

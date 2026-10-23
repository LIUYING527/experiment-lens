# Changelog

Notable changes to Experiment Lens are recorded here.

## Unreleased

- Added a dedicated Training & Evaluation panel with live numeric metric curves grouped by metric and split.
- Added Python SDK helpers for training and evaluation metrics, plus a synthetic training demo.
- Added a lightweight Hugging Face Trainer callback that forwards training logs, validation metrics, and run completion without requiring Transformers as an SDK dependency.
- Overlay metric curves from recent runs to make experiment progress easier to compare.
- Import existing CSV, JSONL, and NDJSON training logs, including TensorBoard scalar CSV exports and slash-style train/eval tags.
- Add a `--metric-name` override for TensorBoard scalar CSVs that do not include a `Tag` column.
- Make `--watch` consume only newly appended complete CSV/JSONL rows instead of rescanning the entire log on every poll.

- Added CI and Windows installer status badges to the README.
- Documented the current run history, replay, comparison, export, and persistence capabilities.
- Added a first-run troubleshooting guide for the local service, SDK, port conflicts, and Claude Code hooks.
- Added a security and privacy document covering local networking, event metadata, persistence, and reporting vulnerabilities.
- Updated the documented Node.js requirement to match the Windows installer build environment.
- Added a byte-based 20 MiB request-body limit and clear HTTP errors for malformed or oversized event submissions.
- Added unit tests for valid JSON, malformed JSON, and oversized request bodies.
- Improved the port-conflict troubleshooting commands so they can be copied without editing a placeholder.

## 0.1.0

- Initial Windows-first Electron viewer and local event service.
- Dependency-free Python SDK for metrics, actions, images, goals, and trajectories.
- Bounded local JSONL event history and live WebSocket updates.
- Run history, filtering, read-only replay, run comparison, and JSON export.
- Experimental metadata-only Claude Code hook adapter with installer and uninstaller.

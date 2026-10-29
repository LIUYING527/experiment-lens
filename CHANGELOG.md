# Changelog

Notable changes to Viziverse are recorded here. The GitHub repository and Python package retain the legacy \`experiment-lens\` name during migration.

## Unreleased

- Added in-app file import for JSON event arrays, JSONL/NDJSON, event-oriented CSV, TensorBoard scalar CSV, and wide numeric metric CSVs. Imported events are session-only until exported.
- Added a dependency-free JavaScript SDK and protocol conformance tests.
- Documented the initial version-1 event envelope and normalized legacy events at ingestion.
- Batch live UI refreshes with requestAnimationFrame to avoid re-rendering the full dashboard for every event in a burst.

- Repositioned the product from an experiment-focused observer to Viziverse: a local-first visualization workspace for agent workflows, training/evaluation, robotics, pipelines, and custom processes.
- Added a product vision and target architecture that distinguish implemented functionality from future extensibility work.
- Documented a versioned canonical event protocol, semantic/view registries, scene composition, and 1.0 acceptance gates as the direction for future implementation.
- Updated the desktop-facing product label and installer artifact naming to Viziverse while retaining the existing Electron app ID for upgrade compatibility.
- Clarified that automatic visualization of arbitrary data is a goal, not a completed feature.

- Added a dedicated Training & Evaluation panel with live numeric metric curves grouped by metric and split.
- Added Python SDK helpers for training and evaluation metrics, plus a synthetic training demo.
- Added a lightweight Hugging Face Trainer callback that forwards training logs, validation metrics, and run completion without requiring Transformers as an SDK dependency.
- Overlay metric curves from recent runs to make experiment progress easier to compare.
- Import CSV, JSONL, and NDJSON training logs, including TensorBoard scalar CSV exports and slash-style train/eval tags.
- Add a \`--metric-name\` override for TensorBoard scalar CSVs that do not include a \`Tag\` column.
- Make \`--watch\` consume newly appended complete CSV/JSONL rows instead of rescanning the entire log on every poll.
- Added CI and Windows installer status badges, first-run troubleshooting, and security/privacy documentation.
- Added a byte-based 20 MiB request-body limit and tests for valid JSON, malformed JSON, and oversized submissions.

## 0.1.0

- Initial Windows-first Electron viewer and local event service.
- Dependency-free Python SDK for metrics, actions, images, goals, and trajectories.
- Bounded local JSONL event history and live WebSocket updates.
- Run history, filtering, read-only replay, run comparison, and JSON export.
- Experimental metadata-only Claude Code hook adapter with installer and uninstaller.

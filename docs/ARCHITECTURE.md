# Architecture

Viziverse is evolving from a single desktop observer into a general-purpose, local-first visualization workspace. The current implementation is narrower than the target architecture; this document distinguishes existing behavior from planned work.

## Current implementation

\`\`\`text
Python + JavaScript SDKs / Claude Code adapter / CSV-JSONL-TensorBoard importer
          |
          | POST http://127.0.0.1:7337/events
          v
Electron main process
  ├─ validates local request origin, JSON shape, event type, and body size
  ├─ broadcasts live events over WebSocket /stream
  ├─ maintains bounded in-memory history
  └─ appends sanitized event metadata to local JSONL history
          |
          v
Renderer dashboard
  ├─ training / validation metric curves
  ├─ live event stream and filters
  ├─ run history and read-only replay
  ├─ two-run summary comparison
  ├─ trajectory and latest-image views
  └─ JSON history export
\`\`\`

The HTTP/WebSocket service binds to \`127.0.0.1:7337\`. It is a local desktop service, not a public ingestion endpoint.

## Target architecture

\`\`\`text
Data producers
  ├─ SDKs and framework adapters
  ├─ existing logs and files
  ├─ local processes and custom scripts
  └─ future protocol-compatible sources
           |
           v
Adapter layer: parsing, mapping, source metadata
           |
           v
Canonical event envelope (versioned)
           |
           v
Ingestion + validation + normalization
           |
           v
Event store + derived semantic state
  ├─ runs / sessions / spans
  ├─ metric series
  ├─ artifacts and images
  ├─ spatial samples
  └─ stage / dependency graphs
           |
           v
Semantic registry + view registry
           |
           v
Scene composer / workspace layouts
           |
           v
Desktop renderer + replay + export
\`\`\`

## Architecture principles

### One protocol, many adapters
Source-specific APIs stay in adapters. The core protocol should be small, versioned, and documented so a new integration does not require changes throughout the renderer.

### Share data plumbing, preserve domain meaning
A metric series, nested trace, robot trajectory, and pipeline DAG are different data structures. Share ingestion, storage, navigation, filtering, and workspace composition while allowing each view to express its own semantics.

### Unknown data remains useful
Unrecognized event types should remain available in a raw event inspector. Automatic visualization is a best-effort suggestion, never a reason to discard or conceal data.

### Live and replay share one source of truth
The same normalized events and derived state should power live views, historical replay, comparison, and export.

### Keep the renderer responsive
Batch bursts of events, avoid full re-render on every sample, cap retained history, lazy-load large artifacts, and downsample dense time series while preserving extrema and temporal shape. Performance targets must be measured against repeatable workloads.

### Local-first and secure
Bind local services to loopback, validate payload sizes and origins, use a restrictive Content Security Policy, avoid forwarding sensitive prompt/tool contents by default, and make persistence/retention visible. View extensions must not receive privileged Electron APIs.

## Canonical event envelope (proposed)

The current SDK emits a simple JSON object with \`type\`, optional \`ts\`, optional \`run_id\` / \`run_name\`, and event-specific \`data\`. A future versioned envelope should make these concepts explicit without breaking current producers:

\`\`\`json
{
  "schema_version": "1",
  "event_id": "source-generated-id",
  "type": "metric",
  "ts": 1700000000.0,
  "run_id": "training-run-01",
  "run_name": "baseline",
  "source": {
    "name": "python-sdk",
    "version": "..."
  },
  "data": {
    "name": "loss",
    "value": 0.42,
    "split": "train",
    "step": 1200,
    "epoch": 2
  }
}
\`\`\`

This is a design proposal, not a claim that all fields are implemented or validated today. Schema evolution needs explicit rules for optional fields, legacy events, unknown event types, and payload limits before the protocol is declared stable.

## Initial semantic concepts

- **Run/session:** a bounded unit of work with identity, status, timestamps, and associated events.
- **Event:** an observable fact with a type, timestamp, and structured data.
- **Metric:** a named numeric value with optional split, step, epoch, unit, and metadata.
- **Span/action:** an operation with start/end state, parent relationship, duration, and outcome where available.
- **Artifact:** an image, file, tensor preview, or external reference with metadata and explicit payload/retention rules.
- **Spatial sample:** a point, pose, trajectory, or map element in a declared coordinate frame.
- **Stage/edge:** a task or pipeline component and its dependency relationship.

Not every producer must emit every concept. Adapters should preserve source data and only claim semantics they can establish.

## View registry (planned)

A view should declare supported semantic types and required fields, streaming/replay/comparison support, rendering cost limits, sampling strategy, empty/loading/error states, and interactions such as selection and filtering.

Initial built-in views should cover timeline, metric series, event table, run comparison, image/artifact inspection, and 2D trajectory. Workflow templates can combine these views into agent, training/evaluation, and generic process workspaces.

## SDKs

The Python SDK and dependency-free JavaScript SDK both emit the version-1 event envelope. The JavaScript package is CommonJS and requires Node.js 18 or newer. Both SDKs are optional producers; the viewer does not require either to display events sent directly to its local API.

## Existing event API

- \`GET /health\`: service health and current event count.
- \`GET /events\`: current in-memory history.
- \`POST /events\`: append one JSON event (20 MiB request-body limit).
- \`WS /stream\`: sends a history snapshot on connection and live event messages afterward.

The current viewer retains up to 3,000 events in memory. JSONL persistence is compacted; large image \`data_url\` payloads are removed from persisted and exported metadata.

## Training and evaluation

The SDK helpers \`training_metric()\` and \`evaluation_metric()\` emit metric events with split, phase, epoch, and step metadata. The optional Hugging Face Trainer callback adapts numeric training logs and validation results without requiring Transformers at SDK import time. The dashboard plots numeric metric events and overlays recent runs.

CSV, JSONL, NDJSON, and TensorBoard scalar CSV import is available through the Python log importer. The desktop UI also imports event JSON/JSONL and common metric CSV shapes into the current session; this UI import is intentionally not persisted automatically. Watch mode consumes newly appended complete rows and handles common truncation/rotation cases. It is not a universal parser for every logging format; source-specific adapters remain the intended extension point.

## Security boundaries

- The service listens on loopback only.
- The renderer uses context isolation, sandboxing, and a restrictive Content Security Policy.
- The local event API validates request origin, JSON shape, event type, and request-body size.
- The Claude Code adapter forwards metadata rather than prompt text, tool arguments, or tool output contents.
- Third-party view plugins are a future extension point and must not run with privileged desktop access.

## Development checks

From \`viewer/\`:

- \`npm run check\` — syntax-check Electron and renderer code.
- \`npm test\` — test persistence, local-origin validation, request-body limits, and run-comparison analytics.
- \`npm run dist:win\` — build a Windows x64 NSIS installer.

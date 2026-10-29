# Product Vision: Viziverse

## Mission

Make any process that produces meaningful state observable and understandable through a live, interactive visual workspace.

“Visualize everything” is the ambition, not a claim that one renderer can infer every domain automatically. The product should cover a broad range of workflows through a shared core plus explicit adapters and view plugins.

## The problem

People switch between terminals, log files, experiment trackers, custom dashboards, screenshots, tracing tools, and hand-built visualization scripts. Each tool often understands one narrow data type. Cross-domain workflows require repeated setup and bespoke UI work.

Viziverse should reduce that repeated work:

1. Connect a process or import an existing log.
2. Normalize its data into a documented event model.
3. Suggest useful views based on event semantics.
4. Inspect live state, historical events, and run-to-run changes in one workspace.
5. Let domain experts add a specialized view without forking the core application.

## Target scenarios

- **Agent workflows:** execution timelines, nested operations, tool invocations, retries, errors, replay, and state transitions.
- **AI/ML training and evaluation:** training curves, evaluation splits, checkpoints, hyperparameters, artifacts, run comparisons, and evaluation tables.
- **Robotics and simulation:** camera images, actions, pose/trajectory data, spatial maps, episode timelines, and synchronized replay.
- **Data and automation pipelines:** stage graphs, queue/throughput metrics, task status, retries, and failed-item inspection.
- **General software and custom processes:** structured logs, progress, resource metrics, application events, artifacts, and custom views.

These scenarios overlap, but do not share identical visual needs. The core should share data plumbing, not flatten every workflow into the same dashboard.

## Product promise

- **Connect quickly:** SDKs and importers make the first useful view possible with minimal setup.
- **Understand immediately:** new data streams produce a sensible default view and explain what is recognized.
- **Stay smooth under load:** batch updates, downsample dense charts, and lazy-load large artifacts.
- **Inspect deeply:** every summary connects to the underlying events or samples that produced it.
- **Replay faithfully:** live and historical views share the same event and state model.
- **Remain user-owned:** local-first operation, explicit export, and transparent retention.
- **Extend cleanly:** adapters describe data ingestion; view plugins describe rendering.

## Core architecture boundaries

### 1. Producers and adapters
SDKs, framework hooks, API integrations, and log importers convert source-specific data into the canonical envelope while preserving useful source metadata.

### 2. Canonical event protocol
A versioned envelope with event identity, timestamp, run/session identity, event type, schema version, and event-specific data. It should support structured events without forcing all payloads into one rigid schema.

### 3. Ingestion and validation
Validate size, type, timestamps, schema versions, and payload forms. Normalize compatible legacy events. Reject malformed events with actionable errors rather than silently losing them.

### 4. Event store and state model
Store a bounded live window and optionally persist history. Derive run/session state, time ordering, metric series, artifact references, and replay cursors from the same source of truth.

### 5. Semantic registry
Map event types and field patterns to concepts such as metrics, spans, actions, images, spatial points, stages, and artifacts. Unknown event types remain inspectable as raw structured data.

### 6. View registry
Register views with declared data requirements, supported scales, empty states, and resource limits. Initial built-ins: timeline, metric series, event table, run comparison, image/artifact viewer, and 2D trajectory.

### 7. Scene composition
Compose a workspace from available views using templates or user layouts. Suggested layouts should be editable and reversible; the system must not hide data just because it does not fit a known template.

### 8. Desktop UI and extension API
Keep the desktop app responsive and secure. Keep source adapters and view plugins isolated from privileged Electron APIs; establish stable plugin contracts before third-party plugin execution is enabled.

## Non-goals for the first 1.0

- Replacing Grafana, a full BI suite, or a production telemetry backend.
- Claiming automatic understanding of arbitrary unstructured data.
- Running arbitrary third-party plugin code with unrestricted desktop privileges.
- Sending user data to a hosted service by default.
- Supporting every framework before the core protocol and extension points stabilize.

## 1.0 acceptance gates

- Versioned event schema with examples and compatibility rules.
- At least three distinct workflow templates: agent execution, ML training/evaluation, and generic process monitoring.
- SDK and import paths covered by automated tests.
- Stable replay and run comparison on a documented maximum event volume.
- Installer and clean-machine setup validated.
- Privacy, retention, security, and troubleshooting docs match implementation.
- A demo for each supported workflow that runs without credentials or external services.

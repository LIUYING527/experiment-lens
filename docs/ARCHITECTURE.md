# Architecture

## Data flow

```text
Python SDK / Agent adapter
          |
          | POST http://127.0.0.1:7337/events
          v
Electron main process
  ├─ validates local request origin, JSON object shape, and event type
  ├─ rejects event request bodies larger than 20 MiB with HTTP 413
  ├─ broadcasts the live event over WebSocket /stream
  ├─ keeps a bounded in-memory history
  └─ appends a sanitized event to local JSONL history
          |
          v
Renderer dashboard
  ├─ live event stream and filters
  ├─ training / validation metric curves grouped by metric and split
  ├─ recent-run curve overlays for experiment comparisons
  ├─ run history and read-only event replay
  ├─ two-run summary comparison
  ├─ trajectory and latest-image views
  └─ JSON history export
```

## Event envelope

Events are JSON objects. The SDK typically emits fields like:

```json
{
  "type": "metric",
  "ts": 1700000000.0,
  "run_id": "example-run",
  "run_name": "Example task",
  "data": {
    "name": "success_rate",
    "value": 0.9
  }
}
```

- `type` is required and must be a non-empty string.
- `ts` is normally a Unix timestamp in seconds.
- `run_id` groups events into a run/session; events without one appear under `unassigned`.
- `data` is event-specific metadata. Numeric metric events use `data.name` and `data.value`; `data.split` can distinguish `train`, `validation`, and `test`, while `data.epoch` or the top-level `step` provides an x-axis when available.

The viewer currently keeps the latest 3,000 events. JSONL writes are serialized and periodically compacted. On application exit, pending writes are flushed. Large `data_url` image payloads are removed from persisted and exported event metadata to avoid unbounded storage; live image events can still update the preview while streaming.

## Local service

The HTTP and WebSocket service binds only to `127.0.0.1:7337`; it is not intended to be exposed to a LAN or public network. Requests from non-local browser origins are rejected, and the renderer has a restrictive Content Security Policy. The Python SDK uses local HTTP and does not need browser CORS permissions.

- `GET /health`: service health and current event count
- `GET /events`: current in-memory history
- `POST /events`: append one JSON event (20 MiB request-body limit)
- `WS /stream`: sends a history snapshot on connection and live event messages afterward

## Training and evaluation observability

The SDK helpers `training_metric()` and `evaluation_metric()` emit standard `metric` events with split, phase, epoch, and step metadata. The dashboard updates curves whenever those events arrive, so training metrics may be sent every step while validation metrics may be sent only after an evaluation pass or checkpoint. The current renderer plots numeric metrics and overlays the latest six run IDs; it does not automatically read framework logs or instrument a training loop on its own.

Run `python examples/training_demo.py` to see synthetic train loss, validation loss, and validation accuracy. The demo is for visualization only and does not train a real model.

## Claude Code adapter

The adapter reads Claude Code hook JSON from stdin and sends event metadata to the local viewer. It intentionally does not forward prompt text, tool argument values, or tool output contents. Hook names and payloads can vary between Claude Code versions, so the integration remains experimental until validated against a real installed version.

## Development checks

Run from `viewer/`:

- `npm run check` — syntax-check the Electron main process, renderer modules, and request-body guard
- `npm test` — test persistence, local-origin validation, request-body limits, and run-comparison analytics
- `npm run dist:win` — build a Windows x64 NSIS installer

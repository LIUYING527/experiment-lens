# Viziverse Event Protocol v1

This document describes the initial shared event envelope used by the local viewer and SDKs. The protocol is intentionally permissive: recognized event types receive useful views, while unknown event types remain visible in the event inspector.

## Envelope

A producer sends one JSON object to POST http://127.0.0.1:7337/events.

    {
      "schema_version": "1",
      "event_id": "a-unique-event-id",
      "ts": 1790000000.125,
      "run_id": "run-123",
      "run_name": "example-run",
      "type": "metric",
      "step": 120,
      "data": {
        "name": "loss",
        "value": 0.42,
        "split": "train",
        "epoch": 2
      }
    }

### Envelope fields

- schema_version: string identifying the envelope version. Current SDKs emit "1"; the viewer adds it to legacy events that omit it.
- event_id: producer-generated event identity. The viewer maps the legacy id field when present and generates an ID otherwise.
- ts: positive Unix timestamp in seconds. The viewer accepts numeric seconds or milliseconds from legacy producers and supplies the current time if absent.
- run_id: optional identifier for a run or session. Events without it appear under an unassigned group.
- run_name: optional human-readable run label.
- type: required non-empty string, up to 128 characters.
- step: optional source-specific step or sequence index.
- data: optional object containing event-specific fields; normalized to an empty object when absent.
- Additional top-level fields are preserved for forward compatibility.

## Built-in event families

| Type | Suggested meaning | Useful fields |
| --- | --- | --- |
| run_start, run_end | Run lifecycle | status, timestamps, metadata |
| metric | Numeric measurement | name, value, split, step, epoch, unit |
| action, step | Process or agent activity | name, operation, status, duration |
| image, artifact | Image or output artifact | name, media type, path or data URL |
| trajectory, pose, goal, map | Spatial information | coordinates, points, coordinate frame |
| pipeline_stage, task_stage, dependency_edge | Pipeline state | stage ID, status, source/target IDs |
| log, warning, error, exception | Diagnostics | message, severity, code |
| custom type | Domain-specific event | Any JSON object in data |

These names are conventions, not a closed enum. Adapters should preserve source metadata rather than invent semantics they cannot verify.

## Validation and limits

- The local viewer accepts JSON objects only; arrays and scalar top-level values are rejected.
- type must be a non-empty string of at most 128 characters.
- If present, data must be a JSON object.
- ts must be positive and finite when supplied.
- event_id is limited to 256 characters.
- HTTP request bodies are limited to 20 MiB.
- The viewer currently retains a bounded in-memory history; large image payloads are omitted from persisted history and export.

## Compatibility policy

Version 1 is the first documented envelope, not yet a frozen long-term compatibility guarantee. New optional fields may be added without changing the version. Producers should ignore unknown fields when reading events. Breaking changes require a new schema version and a migration path. Unknown event types must remain inspectable rather than being discarded.

## Minimal examples

Metric:
    {"schema_version":"1","event_id":"m1","ts":1790000000.1,"type":"metric","run_id":"train-01","data":{"name":"val_accuracy","value":0.91,"split":"validation","epoch":4}}

Agent operation:
    {"schema_version":"1","event_id":"a1","ts":1790000000.2,"type":"action","run_id":"agent-01","data":{"name":"search_docs","status":"completed","duration_ms":180}}

Custom event:
    {"schema_version":"1","event_id":"custom-1","ts":1790000000.3,"type":"dataset_shard_processed","run_id":"etl-01","data":{"shard":"part-004","rows":50000,"duration_ms":820}}

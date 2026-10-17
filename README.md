# Experiment Lens

**A real-time observation window for AI agent workflows and experiments.**

Experiment Lens is a Windows-first open-source desktop viewer for observing long-running agent workflows and experiments without requiring agents to write custom visualization code.

## Goals

- Stream structured events from agents and experiments to a local viewer
- Display run status, metrics, actions, logs, images, and optional trajectories
- Provide a small Python SDK and an Electron desktop application
- Keep the core event protocol domain-neutral, with robotics as one supported use case

## Architecture

```text
Agent / Experiment
       |
       | Python SDK over HTTP
       v
Local Event Server (127.0.0.1:7337)
       |
       | WebSocket
       v
Electron Desktop Viewer
```

## Status

Early MVP. The first milestone is a working end-to-end loop from emitted events to a live desktop dashboard. Event persistence, replay, run comparison, and additional agent adapters are planned follow-ups.

## License

MIT

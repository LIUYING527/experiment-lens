# Security and privacy

Experiment Lens is a local-first developer tool. Please review these boundaries before connecting it to a project containing private or sensitive information.

## Current protections

- The viewer's HTTP and WebSocket service binds to `127.0.0.1:7337`, not a public network interface.
- Requests carrying non-local browser origins are rejected.
- Electron renderer isolation is enabled, Node.js integration is disabled, navigation is restricted, and the dashboard has a Content Security Policy.
- The Claude Code adapter is designed to send event metadata only. It does not forward prompt text, tool argument values, or tool output contents.
- Persisted event history is bounded to 3,000 events. Large image data URLs are omitted from persisted history and exports.

## Important limitations

- Event history is stored on the local machine and can contain metadata such as run names, tool names, event timestamps, and working-directory paths. Review exported JSON before sharing it.
- The local endpoint is not an authentication boundary between mutually untrusted local processes. Do not expose it through a reverse proxy, port forward, or network binding.
- The Claude Code adapter is experimental; validate its behavior with your installed Claude Code version before relying on it.
- These protections reduce risk but are not a guarantee that arbitrary event data is safe to collect or share.

## Reporting a vulnerability

Please do not publish exploitable vulnerability details in a public issue. Use GitHub's private vulnerability reporting feature for this repository if it is enabled. If private reporting is unavailable, contact the repository maintainer privately through a channel listed on their GitHub profile and include reproduction steps with any sensitive payloads minimized.

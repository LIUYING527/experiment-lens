# 1.0 Release Readiness

Experiment Lens is not considered 1.0-ready until all required items below are checked.

## Automated gates

- [ ] GitHub Actions CI passes for the release commit.
- [ ] Python SDK tests pass on Python 3.9, 3.11, and 3.12.
- [ ] Viewer syntax checks and event-store/security tests pass.
- [ ] Windows x64 NSIS installer builds successfully on `windows-latest`.
- [ ] The generated installer artifact exists and can be downloaded from the workflow run.
- [ ] Packaged application includes the runtime `ws` dependency.

## Product gates

- [ ] Live event stream connects and reconnects without duplicating the snapshot.
- [ ] Recent history survives a full application restart.
- [ ] History stays bounded and image data URLs are omitted from persisted/exported metadata.
- [ ] Run History filtering, replay controls, two-run comparison, and JSON export work.
- [ ] Training & Evaluation charts correctly plot train/validation metrics by epoch, step, and event time.
- [ ] Periodic evaluation events update curves without requiring per-step reporting.
- [ ] Recent-run overlays and run comparison show metric values without mixing runs.
- [ ] Agent/navigation demo and synthetic training demo both produce a useful first-run experience.
- [ ] Training SDK helpers preserve metric name, value, split, phase, epoch, and step metadata.
- [ ] Claude Code hook installation is idempotent, preserves unrelated settings, and can be cleanly removed.
- [ ] Errors are understandable when the port is occupied, a hook fails, or the history file is malformed.
- [ ] README explains install, usage, data handling, limitations, and troubleshooting.

## Final Windows acceptance

- [ ] Validate the packaged installer on a clean Windows account or machine.
- [ ] Validate the live Python SDK -> desktop viewer chain.
- [ ] Validate the Claude Code hook -> Agent Activity chain with the user's installed Claude Code version.
- [ ] Confirm no prompt text, tool arguments, or tool output contents are sent by the metadata-only Claude Code adapter.
- [ ] Fix any blocker found during acceptance, then rerun automated gates.

## Release

- [ ] Set the app version to `1.0.0`.
- [ ] Update changelog and release notes.
- [ ] Create a `v1.0.0` tag only after all required gates pass.
- [ ] Attach the Windows installer to the GitHub release.

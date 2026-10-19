# Troubleshooting

This guide covers the common first-run problems for the local desktop viewer and the experimental Claude Code adapter.

## Viewer does not start

1. Open PowerShell in the repository's `viewer` directory.
2. Run `npm install` once, then `npm start`.
3. If Electron exits, read the first error printed in the terminal. Confirm that the installed Node.js version is supported by the current `viewer/package.json`.

If you downloaded the Windows installer instead of running from source, try launching the app from the Start Menu and check whether Windows displayed a security prompt.

## Port 7337 is already in use

Experiment Lens listens on `127.0.0.1:7337`. Check which process owns that port before stopping anything:

```powershell
Get-NetTCPConnection -LocalPort 7337 -State Listen -ErrorAction SilentlyContinue |
  Select-Object LocalAddress, LocalPort, OwningProcess
```

To inspect the process name and executable path without replacing a placeholder:

```powershell
Get-NetTCPConnection -LocalPort 7337 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue } |
  Select-Object Id, ProcessName, Path
```

Close the other application normally if it owns the port. The current viewer does not support configuring its listening port.

## The dashboard says it is connecting, or no events appear

With the viewer running, check the local health endpoint:

```powershell
Invoke-RestMethod http://127.0.0.1:7337/health
```

A healthy service returns an object containing `ok: true` and the current event count.

Then check the following:

- Keep the desktop viewer open while sending events.
- Run the Python demo from the repository root: `python examples/vln_demo.py`.
- Confirm the SDK is installed in the same Python environment used to run the demo: `python -m pip show experiment-lens`.
- If using a custom endpoint, set `EXPERIMENT_LENS_URL` before launching the agent process. The viewer's listening port itself remains fixed at 7337.
- The local service intentionally rejects requests with non-local browser origins. Use the SDK or a local adapter rather than posting from a remote website.

## Claude Code events do not appear

1. Confirm the viewer is running and the health endpoint responds.
2. Confirm Python is available in the environment used by Claude Code: `python --version`.
3. From the Experiment Lens repository root, rerun the installer for the target project:

   ```powershell
   python .\integrations\claude-code\install_hooks.py --project "D:\path\to\your\project"
   ```

4. Review that project's `.claude/settings.local.json`. The installer modifies project-local settings only; it does not change global settings.
5. Restart Claude Code in that project and inspect Claude Code's hook diagnostics for errors.

Hook names and payloads can change between Claude Code versions. The adapter is experimental and should not be treated as a guaranteed integration until it has been checked with your installed version.

To remove only Experiment Lens hook commands, run:

```powershell
python .\integrations\claude-code\uninstall_hooks.py --project "D:\path\to\your\project"
```

## Old events or images are missing

The viewer keeps only the most recent 3,000 events. Large image data URLs are intentionally omitted from persisted history and JSON exports; the live preview can show an image while it is streaming, but that image payload is not retained for replay after restart.

History is stored locally in the Electron application's user-data directory. Before manually changing or deleting history files, close the viewer and make a backup. Do not share history exports without checking them for project paths or other metadata you consider sensitive.

## Still stuck?

Open an issue at [GitHub Issues](https://github.com/LIUYING527/experiment-lens/issues) and include:

- Windows version and whether you used the installer or ran from source
- Node.js and Python versions, if applicable
- The exact error message and steps to reproduce
- Whether `http://127.0.0.1:7337/health` responds

Remove access tokens, private paths, prompts, tool arguments, and other sensitive content before posting logs.

"""Small, dependency-free client for the local Experiment Lens viewer."""
from __future__ import annotations

import base64
import json
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path
from typing import Any, Dict, Optional


class Lens:
    """Emit structured events to a local Experiment Lens instance.

    Example:
        lens = Lens(run_name="navigation-test")
        lens.metric("success_rate", 0.72)
        lens.end_run()
    """

    def __init__(self, base_url: str = "http://127.0.0.1:7337", run_name: str = "experiment", timeout: float = 0.5, fail_silently: bool = True):
        self.base_url = base_url.rstrip("/")
        self.run_id = str(uuid.uuid4())[:8]
        self.run_name = run_name
        self.timeout = timeout
        self.fail_silently = fail_silently
        self._step = 0
        self.emit("run_start", {"run_name": run_name, "status": "running"})

    def emit(self, event_type: str, data: Optional[Dict[str, Any]] = None, **kwargs: Any) -> bool:
        payload = {"id": str(uuid.uuid4()), "ts": time.time(), "run_id": self.run_id, "run_name": self.run_name, "type": event_type, "step": self._step, "data": {**(data or {}), **kwargs}}
        req = urllib.request.Request(self.base_url + "/events", data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as response:
                return 200 <= response.status < 300
        except Exception:
            if not self.fail_silently:
                raise
            return False

    def start_run(self, **metadata: Any) -> bool:
        return self.emit("run_start", {"status": "running", **metadata})

    def end_run(self, status: str = "completed", **metadata: Any) -> bool:
        return self.emit("run_end", {"status": status, **metadata})

    def step(self, step: Optional[int] = None, **data: Any) -> bool:
        self._step = self._step + 1 if step is None else int(step)
        return self.emit("step", data)

    def metric(self, name: str, value: Any, **metadata: Any) -> bool:
        return self.emit("metric", {"name": name, "value": value, **metadata})

    def action(self, name: str, **metadata: Any) -> bool:
        return self.emit("action", {"name": name, **metadata})

    def training_metric(self, name: str, value: Any, step: Optional[int] = None, epoch: Optional[float] = None, **metadata: Any) -> bool:
        """Emit a training metric for live plotting (for example train loss)."""
        if step is not None:
            self._step = int(step)
        payload = {"name": name, "value": value, "split": "train", "phase": "training", **metadata}
        if epoch is not None:
            payload["epoch"] = float(epoch)
        return self.emit("metric", payload)

    def evaluation_metric(self, name: str, value: Any, epoch: Optional[int] = None, step: Optional[int] = None, split: str = "validation", **metadata: Any) -> bool:
        """Emit a validation/test metric, usually after an evaluation pass."""
        if step is not None:
            self._step = int(step)
        payload = {"name": name, "value": value, "split": split, "phase": "evaluation", **metadata}
        if epoch is not None:
            payload["epoch"] = int(epoch)
        return self.emit("metric", payload)

    def trajectory(self, points: Any, **metadata: Any) -> bool:
        return self.emit("trajectory", {"points": points, **metadata})

    def goal(self, x: float, y: float, **metadata: Any) -> bool:
        return self.emit("goal", {"x": x, "y": y, **metadata})

    def image(self, path: str, **metadata: Any) -> bool:
        """Send a local image as a base64 data URL (best for small images)."""
        p = Path(path)
        raw = p.read_bytes()
        suffix = p.suffix.lower()
        mime = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif"}.get(suffix, "application/octet-stream")
        encoded = base64.b64encode(raw).decode("ascii")
        return self.emit("image", {"name": p.name, "data_url": f"data:{mime};base64,{encoded}", **metadata})

"""Import existing CSV or JSONL training logs into Experiment Lens.

Accepted formats:
- Wide rows: step, epoch, train_loss, eval_loss, eval_accuracy
- Long rows: step, epoch, name, value, split
- TensorBoard scalar CSV: Wall time, Step, Value (optionally with a Tag column)
- JSONL uses one JSON object per line with the same fields.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import time
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from .client import Lens

_RESERVED = {
    "step", "global_step", "epoch", "split", "phase", "name", "metric", "tag",
    "value", "timestamp", "ts", "run_id", "run_name", "wall time", "wall_time",
    "walltime", "time", "datetime", "date",
}


def _number(value: Any) -> Optional[float]:
    if value is None or isinstance(value, bool) or value == "":
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def _first(row: Dict[str, Any], names: Iterable[str]) -> Any:
    wanted = {name.lower() for name in names}
    for key, value in row.items():
        if key.lower().strip() in wanted and value not in (None, ""):
            return value
    return None


def _metric_name_and_split(column: str, row_split: Any = None) -> Tuple[str, str]:
    lowered = column.lower().strip()
    for prefix, split in (
        ("train_", "train"), ("training_", "train"),
        ("eval_", "validation"), ("validation_", "validation"),
        ("val_", "validation"), ("test_", "test"),
        ("train/", "train"), ("training/", "train"),
        ("eval/", "validation"), ("validation/", "validation"),
        ("val/", "validation"), ("test/", "test"),
    ):
        if lowered.startswith(prefix) and len(column) > len(prefix):
            return column[len(prefix):], split
    split = str(row_split or "train").lower().strip()
    if split in {"eval", "val", "dev"}:
        split = "validation"
    return column, split


def convert_row(row: Dict[str, Any], default_metric_name: Optional[str] = None) -> List[Dict[str, Any]]:
    """Convert one wide or long log row into normalized metric records."""
    if not isinstance(row, dict):
        return []
    step = _number(_first(row, ("step", "global_step")))
    epoch = _number(_first(row, ("epoch",)))
    row_split = _first(row, ("split",))
    explicit_name = _first(row, ("name", "metric", "tag"))
    explicit_value = _number(_first(row, ("value",)))
    if explicit_value is not None and (explicit_name is not None or _first(row, ("value",)) is not None):
        # TensorBoard exports commonly omit Tag when each scalar has its own file.
        name, split = _metric_name_and_split(str(explicit_name or default_metric_name or "value"), row_split)
        return [{"name": name, "value": explicit_value, "split": split, "step": step, "epoch": epoch}]

    records: List[Dict[str, Any]] = []
    for column, raw_value in row.items():
        if column.strip().lower() in _RESERVED or column.strip().lower().endswith("_timestamp"):
            continue
        value = _number(raw_value)
        if value is None:
            continue
        name, split = _metric_name_and_split(str(column), row_split)
        records.append({"name": name, "value": value, "split": split, "step": step, "epoch": epoch})
    return records


def read_log(path: Path) -> List[Dict[str, Any]]:
    suffix = path.suffix.lower()
    if suffix == ".csv":
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            return list(csv.DictReader(handle))
    if suffix in {".jsonl", ".ndjson"}:
        rows = []
        with path.open("r", encoding="utf-8-sig") as handle:
            for line_number, line in enumerate(handle, 1):
                if not line.strip():
                    continue
                try:
                    row = json.loads(line)
                except json.JSONDecodeError as exc:
                    raise ValueError("Invalid JSON on line {}: {}".format(line_number, exc)) from exc
                if not isinstance(row, dict):
                    raise ValueError("Expected a JSON object on line {}".format(line_number))
                rows.append(row)
        return rows
    raise ValueError("Unsupported log format '{}'; use .csv, .jsonl, or .ndjson".format(suffix or "(no extension)"))


def import_rows(rows: Iterable[Dict[str, Any]], lens: Lens, default_metric_name: Optional[str] = None) -> int:
    """Emit normalized metric events for rows and return the number emitted."""
    count = 0
    for row in rows:
        for record in convert_row(row, default_metric_name=default_metric_name):
            step = int(record["step"]) if record["step"] is not None else None
            epoch = record["epoch"]
            if record["split"] == "train":
                lens.training_metric(record["name"], record["value"], step=step, epoch=epoch)
            else:
                lens.evaluation_metric(record["name"], record["value"], epoch=epoch,
                                       step=step, split=record["split"])
            count += 1
    return count



class LogFollower:
    """Incrementally read appended CSV/JSONL rows without rescanning the full file."""

    def __init__(self, path: Path):
        self.path = path
        self._identity = None
        self._offset = 0
        self._last_mtime_ns = None
        self._pending = b""
        self._header: Optional[List[str]] = None
        self._line_number = 0

    def _reset(self, identity: Tuple[int, int]) -> None:
        self._identity = identity
        self._offset = 0
        self._last_mtime_ns = None
        self._pending = b""
        self._header = None
        self._line_number = 0

    def _parse_line(self, raw_line: bytes) -> Optional[Dict[str, Any]]:
        self._line_number += 1
        line = raw_line.decode("utf-8-sig" if self._line_number == 1 else "utf-8").rstrip("\r")
        if not line.strip():
            return None
        if self.path.suffix.lower() in {".jsonl", ".ndjson"}:
            try:
                row = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError("Invalid JSON on line {}: {}".format(self._line_number, exc)) from exc
            if not isinstance(row, dict):
                raise ValueError("Expected a JSON object on line {}".format(self._line_number))
            return row
        try:
            cells = next(csv.reader([line]))
        except csv.Error as exc:
            raise ValueError("Invalid CSV on line {}: {}".format(self._line_number, exc)) from exc
        if self._header is None:
            self._header = [cell.strip() for cell in cells]
            return None
        return dict(zip(self._header, cells))

    def poll(self) -> List[Dict[str, Any]]:
        """Return only complete rows added since the previous poll."""
        stat = self.path.stat()
        identity = (getattr(stat, "st_dev", 0), getattr(stat, "st_ino", 0))
        if (self._identity != identity or stat.st_size < self._offset or
                (self._offset > 0 and stat.st_size == self._offset and
                 self._last_mtime_ns is not None and stat.st_mtime_ns != self._last_mtime_ns)):
            self._reset(identity)

        with self.path.open("rb") as handle:
            handle.seek(self._offset)
            chunk = handle.read()
            self._offset = handle.tell()
        self._last_mtime_ns = stat.st_mtime_ns
        if not chunk:
            return []

        data = self._pending + chunk
        lines = data.split(b"\n")
        self._pending = lines.pop()
        rows: List[Dict[str, Any]] = []
        for raw_line in lines:
            row = self._parse_line(raw_line)
            if row is not None:
                rows.append(row)
        return rows


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Stream CSV/JSONL training logs into Experiment Lens.")
    parser.add_argument("file", type=Path, help="Path to a .csv, .jsonl, or .ndjson log")
    parser.add_argument("--run-name", default=None, help="Name shown in Experiment Lens (defaults to file name)")
    parser.add_argument("--url", default="http://127.0.0.1:7337", help="Local Experiment Lens event endpoint")
    parser.add_argument("--metric-name", default=None, help="Fallback metric name for scalar CSV rows without a Tag (e.g. loss)")
    parser.add_argument("--watch", action="store_true", help="Poll for newly appended rows")
    parser.add_argument("--interval", type=float, default=2.0, help="Polling interval in seconds (default: 2)")
    args = parser.parse_args(argv)

    if args.interval < 0.2:
        parser.error("--interval must be at least 0.2 seconds")
    if not args.file.is_file():
        parser.error("log file does not exist: {}".format(args.file))

    lens = Lens(base_url=args.url, run_name=args.run_name or args.file.stem)
    try:
        if not args.watch:
            rows = read_log(args.file)
            emitted = import_rows(rows, lens, default_metric_name=args.metric_name)
            print("Imported {} metric(s) from {}".format(emitted, args.file.name))
            return 0

        follower = LogFollower(args.file)
        while True:
            rows = follower.poll()
            if rows:
                emitted = import_rows(rows, lens, default_metric_name=args.metric_name)
                if emitted:
                    print("Imported {} metric(s) from new log rows".format(emitted))
            time.sleep(args.interval)
    except KeyboardInterrupt:
        pass
    finally:
        lens.end_run(status="completed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

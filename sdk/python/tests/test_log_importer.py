import csv
import json
import tempfile
import unittest
from pathlib import Path

from experiment_lens.log_importer import convert_row, read_log, import_rows


class FakeLens:
    def __init__(self):
        self.events = []

    def training_metric(self, name, value, step=None, epoch=None, **metadata):
        self.events.append({"name": name, "value": value, "step": step, "epoch": epoch, "split": "train", **metadata})

    def evaluation_metric(self, name, value, epoch=None, step=None, split="validation", **metadata):
        self.events.append({"name": name, "value": value, "step": step, "epoch": epoch, "split": split, **metadata})


class LogImporterTests(unittest.TestCase):
    def test_wide_row_detects_train_and_eval_prefixes(self):
        records = convert_row({"step": "20", "epoch": "2.5", "train_loss": "0.3",
                                "eval_loss": "0.4", "eval_accuracy": "0.9", "notes": "skip"})
        self.assertEqual([(r["name"], r["split"], r["value"]) for r in records], [
            ("loss", "train", 0.3), ("loss", "validation", 0.4), ("accuracy", "validation", 0.9)
        ])
        self.assertEqual(records[0]["step"], 20)
        self.assertEqual(records[0]["epoch"], 2.5)

    def test_long_row_uses_explicit_split(self):
        record = convert_row({"global_step": 7, "name": "accuracy", "value": "0.88", "split": "dev"})[0]
        self.assertEqual(record["name"], "accuracy")
        self.assertEqual(record["split"], "validation")
        self.assertEqual(record["step"], 7)

    def test_non_finite_and_non_numeric_values_are_ignored(self):
        self.assertEqual(convert_row({"step": 1, "loss": "NaN", "message": "hello", "inf": "Infinity"}), [])

    def test_csv_and_jsonl_readers(self):
        with tempfile.TemporaryDirectory() as directory:
            csv_path = Path(directory) / "metrics.csv"
            with csv_path.open("w", newline="", encoding="utf-8") as handle:
                writer = csv.DictWriter(handle, fieldnames=["step", "train_loss"])
                writer.writeheader()
                writer.writerow({"step": 1, "train_loss": 0.5})
            jsonl_path = Path(directory) / "metrics.jsonl"
            jsonl_path.write_text(json.dumps({"step": 2, "eval_loss": 0.4}) + "\n", encoding="utf-8")
            self.assertEqual(len(read_log(csv_path)), 1)
            self.assertEqual(read_log(jsonl_path)[0]["step"], 2)

    def test_import_rows_emits_train_and_validation_metrics(self):
        lens = FakeLens()
        count = import_rows([{"step": 3, "train_loss": 0.2, "eval_loss": 0.3}], lens)
        self.assertEqual(count, 2)
        self.assertEqual(lens.events[0]["split"], "train")
        self.assertEqual(lens.events[0]["step"], 3)
        self.assertEqual(lens.events[1]["split"], "validation")
        self.assertEqual(lens.events[1]["name"], "loss")


if __name__ == "__main__":
    unittest.main()

import csv
import json
import tempfile
import unittest
from pathlib import Path

from experiment_lens.log_importer import LogFollower, convert_row, read_log, import_rows


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

    def test_long_row_uses_case_insensitive_keys_and_explicit_split(self):
        record = convert_row({"Global_Step": 7, "Name": "accuracy", "Value": "0.88", "Split": "dev"})[0]
        self.assertEqual(record["name"], "accuracy")
        self.assertEqual(record["split"], "validation")
        self.assertEqual(record["step"], 7)

    def test_tensorboard_scalar_csv_row_with_tag(self):
        records = convert_row({"Wall time": "1700000000.5", "Step": "42", "Value": "0.125", "Tag": "train/loss"})
        self.assertEqual(records, [{"name": "loss", "value": 0.125, "split": "train", "step": 42.0, "epoch": None}])

    def test_tensorboard_scalar_csv_without_tag_uses_explicit_fallback_name(self):
        records = convert_row({"Wall time": "1700000000.5", "Step": "42", "Value": "0.125"}, default_metric_name="loss")
        self.assertEqual(records, [{"name": "loss", "value": 0.125, "split": "train", "step": 42.0, "epoch": None}])

    def test_tensorboard_scalar_csv_without_tag_has_safe_default_name(self):
        records = convert_row({"Wall time": "1700000000.5", "Step": "42", "Value": "0.125"})
        self.assertEqual(records, [{"name": "value", "value": 0.125, "split": "train", "step": 42.0, "epoch": None}])

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


    def test_jsonl_follower_waits_for_complete_line_and_reads_appends_once(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "metrics.jsonl"
            path.write_text('{"step": 1, "train_loss": 0.5}\n', encoding="utf-8")
            follower = LogFollower(path)
            self.assertEqual(follower.poll(), [{"step": 1, "train_loss": 0.5}])
            self.assertEqual(follower.poll(), [])
            with path.open("a", encoding="utf-8") as handle:
                handle.write('{"step": 2, "train_loss":')
            self.assertEqual(follower.poll(), [])
            with path.open("a", encoding="utf-8") as handle:
                handle.write(' 0.4}\n')
            self.assertEqual(follower.poll(), [{"step": 2, "train_loss": 0.4}])

    def test_csv_follower_reads_header_then_appended_rows(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "metrics.csv"
            path.write_text("step,train_loss\n1,0.5\n", encoding="utf-8")
            follower = LogFollower(path)
            self.assertEqual(follower.poll(), [{"step": "1", "train_loss": "0.5"}])
            with path.open("a", encoding="utf-8") as handle:
                handle.write("2,0.4\n")
            self.assertEqual(follower.poll(), [{"step": "2", "train_loss": "0.4"}])


    def test_follower_replays_rows_after_file_truncation(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "metrics.jsonl"
            path.write_text('{"step": 1, "train_loss": 0.5}\n{"step": 2, "train_loss": 0.4}\n', encoding="utf-8")
            follower = LogFollower(path)
            self.assertEqual(len(follower.poll()), 2)
            path.write_text('{"step": 1, "train_loss": 0.3}\n', encoding="utf-8")
            self.assertEqual(follower.poll(), [{"step": 1, "train_loss": 0.3}])

    def test_follower_waits_for_rotated_file_to_reappear(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "metrics.jsonl"
            path.write_text('{"step": 1}\n', encoding="utf-8")
            follower = LogFollower(path)
            self.assertEqual(follower.poll(), [{"step": 1}])
            path.unlink()
            self.assertEqual(follower.poll(), [])
            path.write_text('{"step": 2, "train_loss": 0.4}\n', encoding="utf-8")
            self.assertEqual(follower.poll(), [{"step": 2, "train_loss": 0.4}])

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

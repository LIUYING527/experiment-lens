import json
import threading
import unittest
from types import SimpleNamespace
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from experiment_lens import HuggingFaceTrainerCallback, Lens


class CaptureHandler(BaseHTTPRequestHandler):
    received = []

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        payload = json.loads(self.rfile.read(length).decode("utf-8"))
        self.__class__.received.append(payload)
        self.send_response(202)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"ok":true}')

    def log_message(self, *_args):
        pass


class LensClientTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        CaptureHandler.received = []
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), CaptureHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base_url = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)

    def setUp(self):
        CaptureHandler.received = []

    def test_init_emits_run_start(self):
        Lens(base_url=self.base_url, run_name="unit-test", fail_silently=False)
        self.assertEqual(len(CaptureHandler.received), 1)
        event = CaptureHandler.received[0]
        self.assertEqual(event["type"], "run_start")
        self.assertEqual(event["run_name"], "unit-test")
        self.assertEqual(event["data"]["status"], "running")
        self.assertTrue(event["id"])

    def test_metric_and_step_payloads(self):
        lens = Lens(base_url=self.base_url, fail_silently=False)
        lens.metric("reward", 0.75, split="validation")
        lens.step(step=4, note="checkpoint")
        metric, step = CaptureHandler.received[1:]
        self.assertEqual(metric["type"], "metric")
        self.assertEqual(metric["data"], {"name": "reward", "value": 0.75, "split": "validation"})
        self.assertEqual(step["step"], 4)
        self.assertEqual(step["data"]["note"], "checkpoint")

    def test_training_and_evaluation_metrics_include_plotting_metadata(self):
        lens = Lens(base_url=self.base_url, run_name="training-run", fail_silently=False)
        lens.training_metric("loss", 0.42, step=12, epoch=3, learning_rate=0.0003)
        lens.evaluation_metric("accuracy", 0.91, epoch=3, split="validation", dataset="dev")
        train, validation = CaptureHandler.received[1:]
        self.assertEqual(train["type"], "metric")
        self.assertEqual(train["step"], 12)
        self.assertEqual(train["data"]["split"], "train")
        self.assertEqual(train["data"]["phase"], "training")
        self.assertEqual(train["data"]["epoch"], 3)
        self.assertEqual(train["data"]["value"], 0.42)
        self.assertEqual(validation["data"]["split"], "validation")
        self.assertEqual(validation["data"]["phase"], "evaluation")
        self.assertEqual(validation["data"]["epoch"], 3)
        self.assertEqual(validation["data"]["dataset"], "dev")

    def test_huggingface_callback_streams_training_and_validation_metrics(self):
        lens = Lens(base_url=self.base_url, run_name="hf-finetune", fail_silently=False)
        callback = HuggingFaceTrainerCallback(lens)
        state = SimpleNamespace(global_step=25, epoch=2.5)
        callback.on_log(None, state, None, logs={
            "loss": 0.31,
            "learning_rate": 0.0002,
            "eval_loss": 0.42,
            "message": "skip non-numeric",
        })
        callback.on_evaluate(None, state, None, metrics={
            "eval_loss": 0.38,
            "eval_accuracy": 0.89,
            "eval_runtime": 1.2,
        })
        events = CaptureHandler.received[1:]
        self.assertEqual([event["data"]["name"] for event in events], [
            "loss", "learning_rate", "loss", "accuracy"
        ])
        self.assertEqual(events[0]["data"]["split"], "train")
        self.assertEqual(events[0]["data"]["epoch"], 2.5)
        self.assertEqual(events[0]["step"], 25)
        self.assertEqual(events[2]["data"]["split"], "validation")
        self.assertEqual(events[2]["data"]["phase"], "evaluation")
        self.assertEqual(events[2]["data"]["value"], 0.38)

        callback.on_train_end(None, state, None)
        self.assertEqual(CaptureHandler.received[-1]["type"], "run_end")
        self.assertEqual(CaptureHandler.received[-1]["data"]["status"], "completed")

    def test_fail_silently_can_be_disabled(self):
        lens = Lens(base_url="http://127.0.0.1:1", timeout=0.05, fail_silently=True)
        self.assertFalse(lens.metric("should_not_raise", 1))
        strict = Lens(base_url=self.base_url, timeout=0.05, fail_silently=False)
        strict.base_url = "http://127.0.0.1:1"
        with self.assertRaises(Exception):
            strict.metric("should_raise", 1)


if __name__ == "__main__":
    unittest.main()

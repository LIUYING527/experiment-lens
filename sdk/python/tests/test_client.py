import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from experiment_lens import Lens


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

    def test_fail_silently_can_be_disabled(self):
        lens = Lens(base_url="http://127.0.0.1:1", timeout=0.05, fail_silently=True)
        self.assertFalse(lens.metric("should_not_raise", 1))
        strict = Lens(base_url="http://127.0.0.1:1", timeout=0.05, fail_silently=False)
        with self.assertRaises(Exception):
            strict.metric("should_raise", 1)


if __name__ == "__main__":
    unittest.main()

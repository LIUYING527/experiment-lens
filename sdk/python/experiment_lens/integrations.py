"""Optional framework adapters for Experiment Lens.

These adapters intentionally avoid importing training frameworks at module import
time. The Hugging Face callback follows the TrainerCallback method protocol and
can be used when Transformers is installed, without making it an SDK dependency.
"""
from __future__ import annotations

from typing import Any, Dict, Optional

from .client import Lens


class HuggingFaceTrainerCallback:
    """Stream Hugging Face Trainer logs and evaluation metrics to Experiment Lens.

    Usage:
        lens = Lens(run_name="my-finetune")
        trainer.add_callback(HuggingFaceTrainerCallback(lens))
    """

    _NON_QUALITY_EVAL_KEYS = {
        "eval_runtime",
        "eval_samples_per_second",
        "eval_steps_per_second",
    }

    def __init__(self, lens: Lens, validation_split: str = "validation") -> None:
        self.lens = lens
        self.validation_split = validation_split

    @staticmethod
    def _number(value: Any) -> Optional[float]:
        if isinstance(value, bool):
            return None
        try:
            number = float(value)
        except (TypeError, ValueError):
            return None
        return number if number == number and abs(number) != float("inf") else None

    @staticmethod
    def _position(state: Any) -> Dict[str, Any]:
        position: Dict[str, Any] = {}
        step = getattr(state, "global_step", None)
        epoch = getattr(state, "epoch", None)
        if step is not None:
            position["step"] = int(step)
        if epoch is not None:
            try:
                position["epoch"] = float(epoch)
            except (TypeError, ValueError):
                pass
        return position

    def on_log(self, args: Any, state: Any, control: Any, logs: Optional[Dict[str, Any]] = None, **kwargs: Any) -> Any:
        """Forward numeric training logs; evaluation logs are handled separately."""
        del args, kwargs
        logs = logs or {}
        position = self._position(state)
        step = position.get("step")
        epoch = position.get("epoch")
        for name, raw_value in logs.items():
            if name.startswith("eval_") or name in self._NON_QUALITY_EVAL_KEYS:
                continue
            value = self._number(raw_value)
            if value is None:
                continue
            self.lens.training_metric(name, value, step=step, epoch=epoch)
        return control

    def on_train_end(self, args: Any, state: Any, control: Any, **kwargs: Any) -> Any:
        """Mark the run complete when Hugging Face Trainer finishes."""
        del args, state, kwargs
        self.lens.end_run(status="completed")
        return control

    def on_evaluate(self, args: Any, state: Any, control: Any, metrics: Optional[Dict[str, Any]] = None, **kwargs: Any) -> Any:
        """Forward evaluation results as validation-split metric events."""
        del args, kwargs
        metrics = metrics or {}
        position = self._position(state)
        step = position.get("step")
        epoch = position.get("epoch")
        for raw_name, raw_value in metrics.items():
            name = raw_name[5:] if raw_name.startswith("eval_") else raw_name
            if raw_name in self._NON_QUALITY_EVAL_KEYS:
                continue
            value = self._number(raw_value)
            if value is None:
                continue
            self.lens.evaluation_metric(
                name,
                value,
                epoch=epoch,
                step=step,
                split=self.validation_split,
            )
        return control

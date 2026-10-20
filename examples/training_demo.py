"""Synthetic training demo: python examples/training_demo.py.

Shows how to stream train/validation metrics into Experiment Lens. Replace the
synthetic values and loop with your real training/evaluation loop.
"""
import math
import random
import time

from experiment_lens import Lens

random.seed(7)
lens = Lens(run_name="training-evaluation-demo")
lens.emit("note", {"message": "Synthetic metrics only; this is not a real model run."})

for epoch in range(1, 31):
    train_loss = 1.4 * math.exp(-epoch / 9) + random.uniform(0.0, 0.035)
    lens.training_metric(
        "loss",
        round(train_loss, 5),
        step=epoch,
        epoch=epoch,
        learning_rate=0.001 * (0.96 ** (epoch - 1)),
    )

    # Simulate a validation pass every second epoch, as many training loops do.
    if epoch % 2 == 0:
        val_loss = 1.5 * math.exp(-epoch / 10) + 0.025 + random.uniform(0.0, 0.05)
        val_accuracy = min(0.97, 0.52 + 0.46 * (1 - math.exp(-epoch / 8)) + random.uniform(-0.018, 0.018))
        lens.evaluation_metric("loss", round(val_loss, 5), epoch=epoch, step=epoch, split="validation")
        lens.evaluation_metric("accuracy", round(val_accuracy, 5), epoch=epoch, step=epoch, split="validation")

    time.sleep(0.2)

lens.end_run(status="completed", epochs=30, note="Synthetic demonstration complete")
print("Synthetic training metrics sent. Select loss or accuracy in Experiment Lens.")

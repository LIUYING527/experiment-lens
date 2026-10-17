"""Synthetic demo: python examples/vln_demo.py"""
import math
import random
import time
from experiment_lens import Lens

lens = Lens(run_name="vln-navigation-demo")
lens.emit("note", {"message": "Synthetic demo run started"})
points = []
for step in range(1, 41):
    t = step / 8
    x, y = t, math.sin(t) * 0.7
    points.append([x, y])
    lens.step(step=step, observation="rgb_frame", waypoint=[round(x, 3), round(y, 3)])
    lens.metric("distance_to_goal", max(0.0, 8 - step * 0.18))
    lens.action(random.choice(["move_forward", "turn_left", "turn_right"]))
    if step % 5 == 0:
        lens.trajectory(points)
    time.sleep(0.15)
lens.metric("success", 1)
lens.end_run(status="completed", total_steps=40)
print("Demo events sent. Check the Experiment Lens viewer.")

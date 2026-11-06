"""Арифметика примеров раздела ml/boosting и синтаксис примера API."""

import ast
from html import unescape
import json
from math import exp, log, log1p
from pathlib import Path
import re
from statistics import mean


ROOT = Path(__file__).resolve().parents[1]


def sigmoid(logit):
    return 1 / (1 + exp(-logit))


def fit_mse(residuals, leaves):
    error = 0
    for leaf in leaves:
        center = mean(residuals[i] for i in leaf)
        error += sum((residuals[i] - center) ** 2 for i in leaf)
    return error / len(residuals)


stars = [5, 4, 2, 1]
baseline = mean(stars)
residuals = [y - baseline for y in stars]
assert residuals == [2, 1, -1, -2]
assert mean(r**2 for r in residuals) == 2.5
assert fit_mse(residuals, [[0, 1], [2, 3]]) == 0.25

script = (ROOT / "figures/gb.js").read_text(encoding="utf-8")
orders = json.loads(re.search(r"const GB_ORDERS = (\[[\s\S]*?\]);", script).group(1))
assert orders == [
    [0, 0, 0], [0, 1, 0], [0, 0, 0], [0, 1, 1],
    [1, 0, 0], [1, 1, 1], [1, 0, 1], [1, 0, 1],
]
labels = [order[2] for order in orders]
prior = mean(labels)
logits = [log(prior / (1 - prior))] * len(orders)
losses = [log(2)]
partitions = [
    [[i for i, order in enumerate(orders) if order[j] == leaf] for leaf in (0, 1)]
    for j in (0, 1)
]
expected_errors = [(0.1875, 0.2333), (0.1875, 0.1779)]
expected_shifts = [(-0.5, 0.5), (-0.265, 0.441)]
for step, split in enumerate((0, 1)):
    probabilities = [sigmoid(z) for z in logits]
    residuals = [y - p for y, p in zip(labels, probabilities)]
    errors = [fit_mse(residuals, partition) for partition in partitions]
    assert tuple(round(v, 4) for v in errors) == expected_errors[step]
    assert errors[split] < errors[1 - split]
    shifts = []
    for leaf in partitions[split]:
        residual_sum = sum(residuals[i] for i in leaf)
        curvature = sum(probabilities[i] * (1 - probabilities[i]) for i in leaf)
        shift = 0.5 * residual_sum / curvature
        shifts.append(shift)
        for i in leaf:
            logits[i] += shift
    assert tuple(round(v, 3) for v in shifts) == expected_shifts[step]
    losses.append(mean(log1p(exp(z)) - y * z for y, z in zip(labels, logits)))
    if step == 0:
        assert round(sigmoid(logits[3]), 3) == 0.378
        assert round(sigmoid(logits[4]), 3) == 0.622

assert [round(v, 3) for v in losses] == [0.693, 0.599, 0.558]
assert round(sigmoid(logits[3]), 3) == 0.485
assert round(sigmoid(logits[4]), 3) == 0.559

html = (ROOT / "sections/ml/boosting.html").read_text(encoding="utf-8")
code = re.search(r"<pre><code>([\s\S]*?)</code></pre>", html).group(1)
ast.parse(unescape(code))
print("Бустинг. Остатки, два разбиения, поправки, вероятности, log-loss и синтаксис примера — OK.")

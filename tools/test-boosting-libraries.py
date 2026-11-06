"""Проверка условных примеров раздела ml/boosting-libraries."""

import ast
from fractions import Fraction as F
from html import unescape
import json
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]


def orders(script, constant):
    source = (ROOT / "figures" / script).read_text(encoding="utf-8")
    return json.loads(re.search(rf"const {constant} = (\[[\s\S]*?\]);", source).group(1))


labels = [row[2] for row in orders("gb.js", "GB_ORDERS")]
gradients = [F(1, 2) - y for y in labels]


def sums(indices):
    return sum(gradients[i] for i in indices), F(len(indices), 4)


def gain(left, right, penalty, leaf_cost=0):
    gl, hl = sums(left)
    gr, hr = sums(right)
    parent = (gl + gr) ** 2 / (hl + hr + penalty)
    children = gl**2 / (hl + penalty) + gr**2 / (hr + penalty)
    return (children - parent) / 2 - leaf_cost


left, right = list(range(4)), list(range(4, 8))
assert sums(left) == (1, 1) and sums(right) == (-1, 1)
assert tuple(-g / (h + 1) for g, h in (sums(left), sums(right))) == (F(-1, 2), F(1, 2))
assert gain(left, right, 1, F("0.3")) == F("0.2")
assert gain(left, right, 4, F("0.3")) == F("-0.1")
assert gain(left, right, 1) == F("0.5")
assert gain(left[1:], [0, *right], 1) == F(8, 63)
assert 4 * F("0.99") * F("0.01") == F("0.0396")

histogram = [sums([i, i + 1]) for i in range(0, 8, 2)]
assert histogram == [(1, F(1, 2)), (0, F(1, 2)), (0, F(1, 2)), (-1, F(1, 2))]
assert tuple(map(sum, zip(*histogram[:2]))) == sums(left)
assert tuple(map(sum, zip(*histogram[2:]))) == sums(right)

ordered = orders("bl.js", "BL_ORDERS")
assert [row[0] for row in ordered] == [4, 2, 5, 6]
assert all(labels[order - 1] == label for order, _, label in ordered)


def encode(seller, rows):
    same = [label for _, name, label in rows if name == seller]
    return F(sum(same) + 1, len(same) + 2)


assert [encode(seller, ordered[:i]) for i, (_, seller, _) in enumerate(ordered)] == [
    F(1, 2), F(2, 3), F(1, 2), F(1, 2),
]
assert [encode(seller, ordered) for seller in ("А", "Б")] == [F(3, 5), F(1, 3)]

html = (ROOT / "sections/ml/boosting-libraries.html").read_text(encoding="utf-8")
ast.parse(unescape(re.search(r"<pre><code>([\s\S]*?)</code></pre>", html).group(1)))
print("XGBoost, LightGBM и CatBoost. Числа примеров и синтаксис Python проверены.")

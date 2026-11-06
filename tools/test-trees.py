"""Арифметика примеров ml/trees и синтаксис фрагмента Python."""
import ast
import html
import json
from math import isclose, log
from pathlib import Path
import re
from statistics import mean, median, pvariance

root = Path(__file__).resolve().parents[1]
source = (root / 'sections/ml/trees.html').read_text()
figures = (root / 'figures/tree.js').read_text()
snippet = re.search(r'<pre><code>(.*?)</code></pre>', source, re.S)[1]
ast.parse(html.unescape(snippet), filename='ml/trees: scikit-learn')

# Таблица заказов и схема используют одни данные.
table = re.search(r'<tbody>(.*?)</tbody>', source, re.S)[1]
rows = re.findall(r'<tr><td>\d+</td><td>\\\(([\d.]+)\\\)</td>'
                  r'<td>\\\((\d+)\\\)</td><td>(да|нет)</td></tr>', table)
orders = [[float(delay), int(price), int(negative == 'да')]
          for delay, price, negative in rows]
assert orders == json.loads(re.search(r'const TREE_HAND = (.*?);', figures)[1])


def gini(labels):
    p = mean(labels)
    return 1 - p ** 2 - (1 - p) ** 2


def entropy(labels):
    p = mean(labels)
    return -sum(q * log(q) for q in (p, 1 - p) if q > 0)


def class_error(labels):
    p = mean(labels)
    return min(p, 1 - p)


def after_split(left, right, loss):
    return (len(left) * loss(left) + len(right) * loss(right)) / (len(left) + len(right))


def gains(rows, feature, loss):
    values = sorted({row[feature] for row in rows})
    before = loss([row[-1] for row in rows])
    for a, b in zip(values, values[1:]):
        threshold = (a + b) / 2
        left = [row[-1] for row in rows if row[feature] <= threshold]
        right = [row[-1] for row in rows if row[feature] > threshold]
        yield before - after_split(left, right, loss), threshold


left_orders = [row for row in orders if row[0] <= 6.25]
left = [row[-1] for row in left_orders]
right = [row[-1] for row in orders if row[0] > 6.25]
assert (sum(left), len(left), sum(right), len(right)) == (3, 6, 4, 4)

for loss, expected in [(class_error, (0.30, 0.30, 0)),
                       (gini, (0.42, 0.30, 0.12)),
                       (entropy, (0.611, 0.416, 0.195))]:
    before, after = loss(left + right), after_split(left, right, loss)
    assert tuple(round(v, 3) for v in (before, after, before - after)) == expected

delay_gain, delay_threshold = max(gains(orders, 0, gini))
price_gain, price_threshold = max(gains(orders, 1, gini))
assert (round(delay_gain, 2), delay_threshold) == (0.12, 6.25)
assert (round(price_gain, 3), price_threshold) == (0.077, 21.5)
child_gain, child_threshold = max(gains(left_orders, 1, gini))
assert (child_gain, child_threshold) == (0.5, 21.5)
price_contribution = len(left) / len(orders) * child_gain
total_gain = delay_gain + price_contribution
assert isclose(total_gain, gini(left + right))
assert (round(100 * delay_gain / total_gain), round(100 * price_contribution / total_gain)) == (29, 71)
assert isclose(total_gain / (3 - 1), 0.21)  # Равенство стоимости одного и трёх листьев.

# Квадратичная потеря по всем компонентам вектора вероятностей.
for labels in (left + right, left, right):
    p = mean(labels)
    for q in (0.1, p, 0.9):
        brier = mean((q - y) ** 2 + ((1 - q) - (1 - y)) ** 2 for y in labels)
        assert isclose(brier, gini(labels) + 2 * (q - p) ** 2)

ratings = [5, 5, 4, 2, 1, 2]
rating_rows = list(zip([1, 2, 3, 7, 8, 9], ratings))
assert mean(ratings) == 19 / 6 and pvariance(ratings) == 89 / 36
assert (mean(ratings[:3]), mean(ratings[3:])) == (14 / 3, 5 / 3)
assert isclose(after_split(ratings[:3], ratings[3:], pvariance), 2 / 9)
assert max(gains(rating_rows, 0, pvariance)) == (2.25, 5)
mae = lambda values: mean(abs(y - median(values)) for y in values)
assert (median(ratings[:3]), median(ratings[3:])) == (5, 2)
assert isclose(after_split(ratings[:3], ratings[3:], mae), 2 / 6)
assert (mean([2, 2, 5]), median([2, 2, 5])) == (3, 2)
print('trees: таблица, критерии, пороги, MDI, обрезка и синтаксис Python — OK.')

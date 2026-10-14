"""Числа раздела ml/generalization: только стандартная библиотека, без моделей."""
import contextlib
from fractions import Fraction
import html
import io
import math
from pathlib import Path
import random
import re

root = Path(__file__).resolve().parents[1]
source = (root / 'sections/ml/generalization.html').read_text()

# 1. Код из HTML воспроизводит таблицу bias-variance для kNN-регрессии.
snippet = html.unescape(re.findall(r'<pre><code>(.*?)</code></pre>', source, re.S)[0])
namespace, output = {}, io.StringIO()
with contextlib.redirect_stdout(output):
    exec(compile(snippet, 'generalization:first-example', 'exec'), namespace)
expected = [line[2:] for line in snippet.splitlines() if line.startswith('# ')]
assert output.getvalue().splitlines() == expected, output.getvalue()
table = {1: (0.0016, 2, 2.0016), 2: (0.2116, 1, 1.2116), 3: (0.3927, 0.6667, 1.0594),
         4: (2.1316, 0.5, 2.6316), 5: (3.8416, 0.4, 4.2416)}
for k, row in table.items():
    bias2, var = namespace['knn_bias_variance'](lambda x: x * x, range(-3, 4), 0.2, 2.0, k)
    assert all(math.isclose(a, b, abs_tol=5e-5) for a, b in zip((bias2, var, bias2 + var), row)), (k, bias2, var)

# 2. Формула ESL 7.10 против моделирования: входы фиксированы, шумятся только метки.
gen = random.Random(0)
xs, x0, sigma2, reps = list(range(-3, 4)), 0.2, 2.0, 40000
order = sorted(xs, key=lambda x: abs(x - x0))
for k, (bias2, var, _) in table.items():
    preds, sq_err = [], 0.0
    for _ in range(reps):
        noisy = {x: x * x + gen.gauss(0, math.sqrt(sigma2)) for x in order[:k]}
        pred = sum(noisy.values()) / k
        y0 = x0 * x0 + gen.gauss(0, math.sqrt(sigma2))
        preds.append(pred)
        sq_err += (y0 - pred) ** 2
    mean = sum(preds) / reps
    emp_var = sum((p - mean) ** 2 for p in preds) / reps
    assert abs((x0 * x0 - mean) ** 2 - bias2) < 0.03, (k, mean)
    assert abs(emp_var / var - 1) < 0.03, (k, emp_var)
    assert abs(sq_err / reps / (sigma2 + bias2 + var) - 1) < 0.03, (k, sq_err / reps)

# 3. Проклятие размерности: моменты Delta = U - U' и относительный разброс sqrt(7 / (5d)).
e2 = Fraction(1, 12) * 2
e4 = 2 * (Fraction(1, 5) - Fraction(1, 6))          # плотность Delta: 1 - |t| на [-1, 1]
assert e2 == Fraction(1, 6) and e4 - e2 ** 2 == Fraction(7, 180)
spread = {d: math.sqrt(7 / (5 * d)) for d in (2, 100, 768)}
assert (round(spread[2], 2), round(spread[100], 2), round(spread[768], 3)) == (0.84, 0.12, 0.043)
d, pairs, sq = 100, 4000, []
for _ in range(pairs):
    sq.append(sum((gen.random() - gen.random()) ** 2 for _ in range(d)))
m = sum(sq) / pairs
assert abs(math.sqrt(sum((s - m) ** 2 for s in sq) / pairs) / m / spread[d] - 1) < 0.08
assert (round(0.01 ** 0.1, 2), round(0.1 ** 0.1, 2)) == (0.63, 0.79)

# 4. Данные иллюстрации gen-knn: тот же генератор Mulberry32, что rng() в figures/common.js.
M = 0xFFFFFFFF

def mulberry32(seed):
    a = seed & M
    def step():
        nonlocal a
        a = (a + 0x6D2B79F5) & M
        t = ((a ^ (a >> 15)) * (1 | a)) & M
        t = ((t + (((t ^ (t >> 7)) * (61 | t)) & M)) & M) ^ t
        return ((t ^ (t >> 14)) & M) / 4294967296
    return step

def boundary(x):
    return 0.5 + 0.28 * math.sin(2 * math.pi * 1.4 * (x - 0.12))

def sample(seed, n, noise=0.12):
    r, pts = mulberry32(seed), []
    for _ in range(n):
        x, y = r(), r()
        p = 1 / (1 + math.exp(-(y - boundary(x)) / noise))
        pts.append((x, y, 1 if r() < p else 0, 1 if p >= 0.5 else 0))
    return pts

train, val = sample(42, 100), sample(1042, 1500)
ks = [1, 3, 5, 7, 9, 13, 17, 23, 31, 41, 55, 71, 99]

def error(points, k):
    wrong = 0
    for qx, qy, c, _ in points:
        near = sorted(train, key=lambda p: (p[0] - qx) ** 2 + (p[1] - qy) ** 2)[:k]
        wrong += (1 if 2 * sum(p[2] for p in near) > k else 0) != c
    return wrong / len(points)

tr = {k: error(train, k) for k in ks}
va = {k: error(val, k) for k in ks}
bayes = sum(b != c for _, _, c, b in val) / len(val)
best = min(va.values())
assert tr[1] == 0 and round(100 * va[1], 1) == 25.9 and round(100 * bayes, 1) == 14.5
assert round(100 * best, 1) == 16.1 and {k for k in ks if va[k] <= best + 0.01} == {5, 7, 9, 13}
assert round(100 * va[99], 1) == 50.7
assert round(100 * 2 * bayes * (1 - bayes), 1) == 24.8
print('generalization: код из HTML, формула kNN против моделирования, концентрация расстояний, '
      'числа иллюстрации — OK; без моделей.')

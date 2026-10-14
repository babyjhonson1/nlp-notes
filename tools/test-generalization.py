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

# 5. Рисунок gen-bv-curve: точное разложение kNN-регрессии, минимум суммарной ошибки.
def knn_curve(n=50, n_test=400, sigma2=0.25):
    g = lambda x: math.sin(2 * math.pi * x) + 0.5 * math.sin(6 * math.pi * x)
    grid = [(i + 0.5) / n for i in range(n)]
    bias2 = [0.0] * (n + 1)
    for t in range(n_test):
        x0 = (t + 0.5) / n_test
        acc = 0.0
        for j, x in enumerate(sorted(grid, key=lambda x: abs(x - x0))):
            acc += g(x)
            bias2[j + 1] += (g(x0) - acc / (j + 1)) ** 2 / n_test
    return {k: sigma2 + bias2[k] + sigma2 / k for k in range(1, n + 1)}

curve = knn_curve()
assert min(curve, key=curve.get) == 6 and curve[50] > curve[1] > curve[6]

# 6. Линейная регрессия с гауссовскими признаками: формулы рисунков gen-learning и gen-dd.
def solve(a, rhs):
    m = [row[:] + [v] for row, v in zip(a, rhs)]
    size = len(m)
    for c in range(size):
        piv = max(range(c, size), key=lambda r: abs(m[r][c]))
        m[c], m[piv] = m[piv], m[c]
        for r in range(size):
            if r != c and m[r][c]:
                factor = m[r][c] / m[c][c]
                m[r] = [x - factor * y for x, y in zip(m[r], m[c])]
    return [m[i][size] / m[i][i] for i in range(size)]

def least_squares(xp, y):
    n, p = len(xp), len(xp[0])
    if p < n:
        gram = [[sum(xp[i][a] * xp[i][c] for i in range(n)) for c in range(p)] for a in range(p)]
        return solve(gram, [sum(xp[i][a] * y[i] for i in range(n)) for a in range(p)])
    gram = [[sum(xp[i][a] * xp[j][a] for a in range(p)) for j in range(n)] for i in range(n)]
    alpha = solve(gram, y)                                   # решение с минимальной нормой
    return [sum(xp[i][a] * alpha[i] for i in range(n)) for a in range(p)]

def simulate(p, n, beta2, sigma2, reps, seed):
    r, beta = random.Random(seed), [math.sqrt(b) for b in beta2]
    train = test = 0.0
    for _ in range(reps):
        x = [[r.gauss(0, 1) for _ in beta] for _ in range(n)]
        y = [sum(a * b for a, b in zip(row, beta)) + r.gauss(0, math.sqrt(sigma2)) for row in x]
        w = least_squares([row[:p] for row in x], y)
        train += sum((yi - sum(a * b for a, b in zip(row[:p], w))) ** 2 for row, yi in zip(x, y)) / n
        test += sigma2 + sum(b2 for b2 in beta2[p:]) + sum((beta[j] - w[j]) ** 2 for j in range(p))
    return train / reps, test / reps

def dd_risk(p, n, beta2, sigma2):
    head, rest = sum(beta2[:p]), sum(beta2[p:])
    if p <= n - 2:
        return (rest + sigma2) * (1 + p / (n - p - 1))
    return head * (1 - n / p) + (rest + sigma2) * (1 + n / (p - n - 1))

weights = [1 / (j + 1) for j in range(30)]
beta2 = [w / sum(weights) for w in weights]
for p_, seed in ((4, 1), (24, 2)):
    train_mc, test_mc = simulate(p_, 12, beta2, 0.1, 3000, seed)
    assert abs(test_mc / dd_risk(p_, 12, beta2, 0.1) - 1) < 0.03, (p_, test_mc)
    if p_ < 12:                                             # формулы кривых обучения
        s2 = 0.1 + sum(beta2[p_:])
        assert abs(train_mc / (s2 * (12 - p_) / 12) - 1) < 0.03, train_mc

weights = [1 / (j + 1) for j in range(200)]
beta2 = [w / sum(weights) for w in weights]
left = {p_: dd_risk(p_, 40, beta2, 0.1) for p_ in range(1, 39)}
right = {p_: dd_risk(p_, 40, beta2, 0.1) for p_ in range(42, 201)}
bl, br = min(left, key=left.get), min(right, key=right.get)
assert (bl, round(left[bl], 2), br, round(right[br], 2)) == (8, 0.80, 115, 0.89)
assert left[bl] < right[br]                                  # подпись: лучшая модель слева

# 7. Рисунок gen-dist: тот же генератор, отношение самого дальнего расстояния к ближайшему.
r = mulberry32(5)
ratios = {}
for d in (2, 10, 100, 768):
    q = [r() for _ in range(d)]
    dist = []
    for _ in range(1000):
        acc = 0.0
        for j in range(d):
            t = r() - q[j]
            acc += t * t
        dist.append(math.sqrt(acc))
    ratios[d] = max(dist) / min(dist)
assert round(ratios[100], 2) == 1.42 and round(ratios[768], 2) == 1.12, ratios
print('generalization: код из HTML, формула kNN против моделирования, концентрация расстояний, '
      'числа и формулы всех рисунков — OK; без моделей.')

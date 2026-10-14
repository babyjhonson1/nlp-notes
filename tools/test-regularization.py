"""Числа раздела ml/regularization: только стандартная библиотека, без моделей."""
import contextlib
import html
import io
import math
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
source = (root / 'sections/ml/regularization.html').read_text()

# 1. Код из HTML: лассо отдаёт вес одной копии признака, ridge делит поровну.
snippet = html.unescape(re.findall(r'<pre><code>(.*?)</code></pre>', source, re.S)[0])
namespace, output = {}, io.StringIO()
with contextlib.redirect_stdout(output):
    exec(compile(snippet, 'regularization:first-example', 'exec'), namespace)
expected = [line[2:] for line in snippet.splitlines() if line.startswith('# ')]
assert output.getvalue().splitlines() == expected, output.getvalue()
soft = namespace['soft_threshold']
assert (soft(2.5, 1), soft(-0.4, 1), soft(-3, 1)) == (1.5, 0.0, -2)

# 2. Рисунок reg-geometry: решение L1 на оси при штрафе 2.4 * ||w||_1.
A, ws, lam = [[1, 0.5], [0.5, 1]], [2, 0.7], 2.4
w = [0.0, 0.0]
for _ in range(500):                                         # покоординатный спуск для (w-w*)^T A (w-w*) + lam*||w||_1
    for j in range(2):
        k = 1 - j
        z = ws[j] - A[j][k] * (w[k] - ws[k]) / A[j][j]       # минимум квадратичной части по w_j
        w[j] = soft(z, lam / (2 * A[j][j]))
assert abs(w[0] - 1.15) < 1e-12 and w[1] == 0.0
grad2 = 2 * (A[1][0] * (w[0] - ws[0]) + A[1][1] * (w[1] - ws[1]))
assert abs(abs(grad2) - 2.25) < 1e-12 and abs(grad2) <= lam

# 3. Ранняя остановка: множители GD и ridge одинаково ведут себя на сильных и слабых направлениях.
eta, t = 0.01, 100
for d2 in (1000.0, 0.01):
    gd, ridge_f = 1 - (1 - eta * d2) ** t if eta * d2 < 2 else 1.0, d2 / (d2 + 1 / (eta * t))
    assert (gd > 0.99) == (ridge_f > 0.99) and (gd < 0.02) == (ridge_f < 0.02)

# 4. Рисунок reg-path: тот же генератор, что rng() и gauss() в figures/common.js.
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

def gauss(r):
    u = 0.0
    while not u:
        u = r()
    return math.sqrt(-2 * math.log(u)) * math.cos(2 * math.pi * r())

r = mulberry32(1)
X, y = [], []
for _ in range(60):
    s = 1 if r() < 0.2 else 0
    b = 1 if r() < 0.15 else 0
    bb = (1 if r() < 0.85 else 0) if b else (1 if r() < 0.04 else 0)
    o, f, c = (1 if r() < 0.3 else 0), (1 if r() < 0.3 else 0), (1 if r() < 0.25 else 0)
    X.append([s, b, bb, o, f, c])
    y.append(4 - 1.4 * s - 0.6 * b - 0.6 * bb + 0.7 * o + 0.3 * f + 0.6 * gauss(r))
n, d = 60, 6
mu = [sum(row[j] for row in X) / n for j in range(d)]
sd = [math.sqrt(sum((row[j] - mu[j]) ** 2 for row in X) / n) for j in range(d)]
Z = [[(row[j] - mu[j]) / sd[j] for j in range(d)] for row in X]
ym = sum(y) / n
yc = [v - ym for v in y]
assert round(sum(row[1] * row[2] for row in Z) / n, 2) == 0.94     # корреляция «брак» и «бракованный»

def solve(a, rhs):
    m = [row[:] + [v] for row, v in zip(a, rhs)]
    for col in range(len(m)):
        piv = max(range(col, len(m)), key=lambda i: abs(m[i][col]))
        m[col], m[piv] = m[piv], m[col]
        for i in range(len(m)):
            if i != col:
                factor = m[i][col] / m[col][col]
                m[i] = [x - factor * z for x, z in zip(m[i], m[col])]
    return [m[i][-1] / m[i][i] for i in range(len(m))]

def ridge(lam):
    gram = [[sum(row[a] * row[c] for row in Z) + (lam if a == c else 0) for c in range(d)] for a in range(d)]
    return solve(gram, [sum(row[a] * v for row, v in zip(Z, yc)) for a in range(d)])

ols = ridge(0.0)
assert max(abs(ridge(10 ** (-1 + 5 * k / 60))[1] - ridge(10 ** (-1 + 5 * k / 60))[2]) for k in range(61)) < 0.03

amax = max(abs(sum(row[j] * v for row, v in zip(Z, yc))) / n for j in range(d))
w, res, entry, path_bb = [0.0] * d, yc[:], {}, []
for k in range(401):                                         # тёплый старт по убывающей сетке
    alpha = amax * 10 ** (-3 * k / 400)
    for _ in range(5000):
        delta = 0.0
        for j in range(d):
            rho = sum(row[j] * (ri + row[j] * w[j]) for row, ri in zip(Z, res)) / n
            nw = soft(rho, alpha)
            if nw != w[j]:
                for i, row in enumerate(Z):
                    res[i] -= row[j] * (nw - w[j])
                delta, w[j] = max(delta, abs(nw - w[j])), nw
        if delta < 1e-13:
            break
    for j in range(d):
        if w[j] != 0 and j not in entry:
            entry[j] = alpha / amax
    path_bb.append(w[2])
order = sorted(entry, key=entry.get, reverse=True)
assert round(amax, 2) == 0.69 and order[0] == 2 and order[-1] == 5     # первый «бракованный», последний «курьер»
assert 0.45 < entry[1] < 0.6 and 1 / 25 < entry[5] < 1 / 17, entry  # «брак» — около половины, «курьер» — около 1/20
assert (round(min(path_bb), 2), round(ols[2], 2)) == (-0.41, -0.35)
print('regularization: код из HTML, геометрия L1, ранняя остановка, пути регуляризации — OK; без моделей.')

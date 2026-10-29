"""Числа раздела ml/trees: только стандартная библиотека, без моделей."""
import contextlib
import html
from itertools import combinations
import io
import math
from pathlib import Path
import random
import re

root = Path(__file__).resolve().parents[1]
source = (root / 'sections/ml/trees.html').read_text()

# 1. Код из HTML: лучший порог и разбиение категорий.
snippet = html.unescape(re.findall(r'<pre><code>(.*?)</code></pre>', source, re.S)[0])
namespace, output = {}, io.StringIO()
with contextlib.redirect_stdout(output):
    exec(compile(snippet, 'trees:first-example', 'exec'), namespace)
expected = [line[2:] for line in snippet.splitlines() if line.startswith('# ')]
assert output.getvalue().splitlines() == expected, output.getvalue()
gini, counts = namespace['gini'], namespace['counts']

# 1a. Ручной пример: 10 заказов, таблица порогов по задержке, порог по цене, второй уровень.
HAND = [(1, 33, 1), (2, 11, 0), (3, 29, 1), (4, 14, 0), (5, 36, 1), (5.5, 9, 0), (7, 10, 1), (8, 12, 1), (9, 8, 1), (10, 13, 1)]
assert [d for d, _, _ in HAND] == namespace['delay'] and [y for _, _, y in HAND] == namespace['negative']

def table(pts, f):
    s = sorted(pts, key=lambda q: q[f])
    n, total, left, rows = len(s), sum(q[2] for q in s), 0, []
    for i in range(n - 1):
        left += s[i][2]
        if s[i][f] == s[i + 1][f]:
            continue
        nl, nr = i + 1, n - i - 1
        w = nl / n * gini(left, nl) + nr / n * gini(total - left, nr)
        errors = min(left, nl - left) + min(total - left, nr - (total - left))
        rows.append(((s[i][f] + s[i + 1][f]) / 2, nl, left, nr, total - left, round(w, 3), round(gini(total, n) - w, 3), errors))
    return rows

delay_rows = table(HAND, 0)
assert [r[0] for r in delay_rows] == [1.5, 2.5, 3.5, 4.5, 5.25, 6.25, 7.5, 8.5, 9.5]
assert [r[6] for r in delay_rows] == [0.02, 0.02, 0.001, 0.053, 0.02, 0.12, 0.077, 0.045, 0.02]
assert [r[5] for r in delay_rows] == [0.4, 0.4, 0.419, 0.367, 0.4, 0.3, 0.343, 0.375, 0.4]
price_rows = table(HAND, 1)
assert all(r[7] == 3 for r in delay_rows + price_rows) and len(delay_rows + price_rows) == 18   # все 18 вопросов: 3 ошибки
assert max(price_rows, key=lambda r: r[6])[0] == 21.5 and max(r[6] for r in price_rows) == 0.077
left_group = [q for q in HAND if q[0] <= 6.25]
assert max(r[6] for r in table(left_group, 0)) == 0.1
assert max(table(left_group, 1), key=lambda r: r[6])[0::6] == (21.5, 0.5)
assert round(gini(7, 10), 2) == 0.42 and abs(2 * 6 * 4 / 100 * (0.5 - 1) ** 2 - 0.12) < 1e-12
imp_delay, imp_price = 0.12, 6 / 10 * 0.5                       # важности MDI
assert (round(100 * imp_delay / (imp_delay + imp_price)), round(100 * imp_price / (imp_delay + imp_price))) == (29, 71)

# 1b. Регрессия: оценки 5,5,4,2,1,2 при задержке 1,2,3,7,8,9.
rx, ry = [1, 2, 3, 7, 8, 9], [5, 5, 4, 2, 1, 2]
sse = lambda a: sum((v - sum(a) / len(a)) ** 2 for v in a)
gains = {t: sse(ry) - sse([y for x, y in zip(rx, ry) if x <= t]) - sse([y for x, y in zip(rx, ry) if x > t]) for t in (1.5, 2.5, 5, 7.5, 8.5)}
assert max(gains, key=gains.get) == 5 and abs(gains[5] - 13.5) < 1e-12
assert (round(sum(ry) / 6, 2), round(sse(ry), 2), round(sse(ry[:3]), 2)) == (3.17, 14.83, 0.67)

# 2. Категории: сортировка по доле негатива находит оптимум среди всех 2^(K-1)-1 разбиений.
n_all = sum(v[0] for v in counts.values())
pos_all = sum(v[1] for v in counts.values())

def cat_dec(left):
    nl = sum(counts[c][0] for c in left)
    pl = sum(counts[c][1] for c in left)
    return gini(pos_all, n_all) - nl / n_all * gini(pl, nl) - (n_all - nl) / n_all * gini(pos_all - pl, n_all - nl)

cats = list(counts)
partitions = [c for r in range(1, len(cats)) for c in combinations(cats, r) if cats[0] in c]
assert len(partitions) == 2 ** (len(cats) - 1) - 1
assert round(max(cat_dec(c) for c in partitions), 4) == 0.0448
assert round(max(cat_dec((c,)) for c in cats), 4) == 0.0301                      # one-hot
alphabet = sorted(cats)
assert round(max(cat_dec(alphabet[:k]) for k in range(1, len(cats))), 4) == 0.0301  # алфавитный код

# 3. Формулы прироста: Gini для двух классов и сумма квадратов для регрессии.
gen = random.Random(0)
for _ in range(200):
    nl, nr = gen.randint(1, 30), gen.randint(1, 30)
    pl, pr = gen.randint(0, nl), gen.randint(0, nr)
    n = nl + nr
    direct = gini(pl + pr, n) - nl / n * gini(pl, nl) - nr / n * gini(pr, nr)
    assert abs(direct - 2 * nl * nr / n ** 2 * (pl / nl - pr / nr) ** 2) < 1e-12
    left = [gen.gauss(0, 1) for _ in range(nl)]
    right = [gen.gauss(1, 2) for _ in range(nr)]
    sse = lambda a: sum((v - sum(a) / len(a)) ** 2 for v in a)
    gain = sse(left + right) - sse(left) - sse(right)
    assert abs(gain - nl * nr / n * (sum(left) / nl - sum(right) / nr) ** 2) < 1e-9

# 4. Пример «7 негативных из 10 → (4 из 4) и (3 из 6)» и рисунок критериев.
h2 = lambda p: 0.0 if p in (0, 1) else -(p * math.log2(p) + (1 - p) * math.log2(1 - p))
err = lambda p: min(p, 1 - p)
assert (round(gini(7, 10), 2), round(0.4 * gini(4, 4) + 0.6 * gini(3, 6), 2)) == (0.42, 0.30)
assert (round(h2(0.7), 3), round(0.4 * h2(1) + 0.6 * h2(0.5), 3)) == (0.881, 0.600)
assert abs(0.4 * err(1) + 0.6 * err(0.5) - err(0.7)) < 1e-12
assert (round(2 * 0.7 * 0.3 - 0.3, 2), round(h2(0.7) / 2 - 0.3, 2)) == (0.12, 0.14)

# 5. Рисунок tree-grow: тот же генератор, что rng() в figures/common.js, и рост «лучший лист первым».
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

js_round = lambda v: math.floor(v + 0.5)                 # Math.round в JS, а не банковское округление

def orders(seed, n):
    r, pts = mulberry32(seed), []
    for _ in range(n):
        delay, price = js_round(r() * 100) / 10, js_round(r() * 400) / 10
        p = 0.85 if delay > 6 else (0.8 if delay > 3 and price > 25 else 0.1)
        pts.append(((delay, price), 1 if r() < p else 0))
    return pts

def scan(pts, f):
    s = sorted(pts, key=lambda q: q[0][f])
    n, total, left, out = len(s), sum(q[1] for q in s), 0, []
    for i in range(n - 1):
        left += s[i][1]
        if s[i][0][f] == s[i + 1][0][f]:
            continue
        nl, nr = i + 1, n - i - 1
        out.append(((s[i][0][f] + s[i + 1][0][f]) / 2,
                    gini(total, n) - nl / n * gini(left, nl) - nr / n * gini(total - left, nr)))
    return out

def best(pts):
    top = None
    for f in (0, 1):
        for thr, dec in scan(pts, f):
            if top is None or dec > top[2] + 1e-12:
                top = (f, thr, dec)
    return top

train, val = orders(3, 50), orders(1003, 1000)
leaves, splits = [{'pts': train}], []
while True:
    pick = None
    for leaf in leaves:
        if len(leaf['pts']) < 2:
            continue
        leaf.setdefault('best', best(leaf['pts']))
        if not leaf['best'] or leaf['best'][2] <= 1e-12:
            continue
        w = leaf['best'][2] * len(leaf['pts']) / len(train)
        if pick is None or w > pick[1] + 1e-12:
            pick = (leaf, w)
    if pick is None:
        break
    leaf = pick[0]
    f, thr, _ = leaf['best']
    leaf['split'] = (f, thr, len(splits))
    leaf['left'] = {'pts': [q for q in leaf['pts'] if q[0][f] <= thr]}
    leaf['right'] = {'pts': [q for q in leaf['pts'] if q[0][f] > thr]}
    i = leaves.index(leaf)
    leaves[i:i + 1] = [leaf['left'], leaf['right']]
    splits.append(leaf)
tree_root = splits[0]

def error(pts, k):
    wrong = 0
    for x, y in pts:
        node = tree_root
        while 'split' in node and node['split'][2] < k:
            f, thr, _ = node['split']
            node = node['left'] if x[f] <= thr else node['right']
        label = 1 if 2 * sum(q[1] for q in node['pts']) > len(node['pts']) else 0
        wrong += label != y
    return wrong / len(pts)

f0, thr0, dec0 = tree_root['best']
price_best = max(scan(train, 1), key=lambda p: p[1])
assert (f0, thr0, round(dec0, 3)) == (0, 6.05, 0.290) and (round(price_best[0], 2), round(price_best[1], 3)) == (18.8, 0.051)
assert (round(gini(sum(q[1] for q in train), 50), 3), round(gini(sum(q[1] for q in train), 50) - dec0, 3)) == (0.499, 0.209)
errs = [(error(train, k), error(val, k)) for k in range(len(splits) + 1)]
assert errs[2][0] == errs[1][0] and errs[2][1] == errs[1][1]          # второе разбиение не меняет ответов
assert (round(100 * errs[3][0]), round(100 * errs[3][1])) == (8, 15)
assert min(range(len(errs)), key=lambda k: (errs[k][1], k)) == 3        # минимум на validation
assert len(splits) == 13 and errs[-1][0] == 0 and round(100 * errs[-1][1]) == 20

# Байесовская ошибка распределения с учётом округления до 0.1: около 13 %.
p_long = 1 - 60.5 / 100                                  # задержка >= 6.1 дня
p_mid = (1 - 30.5 / 100) - p_long                        # 3.1–6.0 дня
p_exp = 1 - 250.5 / 400                                  # цена >= 25.1 тыс.
bayes = p_long * 0.15 + p_mid * p_exp * 0.2 + (1 - p_long - p_mid * p_exp) * 0.1
assert round(100 * bayes) == 13

# Неустойчивость: 200 бутстрэп-выборок из тех же 50 заказов.
boot = random.Random(0)

def full_leaves(pts):
    if len(pts) < 2:
        return 1
    b = best(pts)
    if not b or b[2] <= 1e-12:
        return 1
    f, thr, _ = b
    return full_leaves([q for q in pts if q[0][f] <= thr]) + full_leaves([q for q in pts if q[0][f] > thr])

roots, second_delay, leaf_counts = [], 0, []
for _ in range(200):
    sample = [train[boot.randrange(50)] for _ in range(50)]
    f, thr, _ = best(sample)
    roots.append((f, thr))
    second_delay += best([q for q in sample if q[0][f] <= thr])[0] == 0
    leaf_counts.append(full_leaves(sample))
thresholds = [t for _, t in roots]
assert all(f == 0 for f, _ in roots) and (round(min(thresholds), 2), round(max(thresholds), 2)) == (2.35, 6.3)
assert second_delay == 40 and (min(leaf_counts), max(leaf_counts)) == (4, 13)

# 6. Рисунок tree-extrap: дерево глубины 3 даёт 8 листьев и константу за пределами обучения.
def gauss(r):
    u = 0.0
    while not u:
        u = r()
    return math.sqrt(-2 * math.log(u)) * math.cos(2 * math.pi * r())

r = mulberry32(21)
xs = list(range(1, 25))
ys = [30 + 2.5 * t + 4 * gauss(r) for t in xs]

def build(idx, depth):
    mean = sum(ys[i] for i in idx) / len(idx)
    if depth == 0 or len(idx) < 2:
        return {'m': mean}
    s = sorted(idx, key=lambda i: xs[i])
    top = None
    for k in range(1, len(s)):
        l, rr = s[:k], s[k:]
        ml, mr = sum(ys[i] for i in l) / len(l), sum(ys[i] for i in rr) / len(rr)
        gain = len(l) * len(rr) / len(s) * (ml - mr) ** 2
        if top is None or gain > top[0]:
            top = (gain, (xs[s[k - 1]] + xs[s[k]]) / 2, l, rr)
    return {'thr': top[1], 'left': build(top[2], depth - 1), 'right': build(top[3], depth - 1)}

tree = build(list(range(24)), 3)
count = lambda nd: 1 if 'm' in nd else count(nd['left']) + count(nd['right'])

def predict(t):
    nd = tree
    while 'thr' in nd:
        nd = nd['left'] if t <= nd['thr'] else nd['right']
    return nd['m']

assert count(tree) == 8 and predict(25) == predict(36) == predict(24)
print('trees: код из HTML, категории, формулы прироста, пример критериев, рисунки — OK; без моделей.')

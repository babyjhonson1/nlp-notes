"""Числа раздела ml/validation: только стандартная библиотека, без моделей."""
import contextlib
import html
import io
import math
from pathlib import Path
import random
import re

root = Path(__file__).resolve().parents[1]
source = (root / 'sections/ml/validation.html').read_text()

# 1. Код из HTML: McNemar и парный бутстрэп.
snippet = html.unescape(re.findall(r'<pre><code>(.*?)</code></pre>', source, re.S)[0])
namespace, output = {}, io.StringIO()
with contextlib.redirect_stdout(output):
    exec(compile(snippet, 'validation:first-example', 'exec'), namespace)
expected = [line[2:] for line in snippet.splitlines() if line.startswith('# ')]
assert output.getvalue().splitlines() == expected == ['0.036', '[0.002, 0.028]'], output.getvalue()
a, b = namespace['a'], namespace['b']
assert len(a) == 1000 and sum(a) == 870 and sum(b) == 855
assert sum(x > y for x, y in zip(a, b)) == 30 and sum(x < y for x, y in zip(a, b)) == 15
chi2 = (abs(30 - 15) - 1) ** 2 / 45
assert round(chi2, 2) == 4.36 and round(math.erfc(math.sqrt(chi2 / 2)), 3) == 0.037
half_widths = [round(100 * 1.96 * math.sqrt(acc * (1 - acc) / 1000), 1) for acc in (0.870, 0.855)]
assert half_widths == [2.1, 2.2]                     # отдельные интервалы +-2.1 и +-2.2 п. п.

# 2. Шум hold-out: точность 0.85 на 200 примерах.
assert round(100 * 1.96 * math.sqrt(0.85 * 0.15 / 200), 1) == 4.9

# 3. Смещение отбора: E max из 20 независимых N(0, 1) и лучшая из 20 равных конфигураций.
phi = lambda x: math.exp(-x * x / 2) / math.sqrt(2 * math.pi)
Phi = lambda x: 0.5 * (1 + math.erf(x / math.sqrt(2)))
h = 20 / 100000
emax = sum(x * 20 * phi(x) * Phi(x) ** 19 for x in (-10 + (i + 0.5) * h for i in range(100000))) * h
s = math.sqrt(0.2 * 0.8 / 500)
assert round(emax, 2) == 1.87 and round(100 * s, 1) == 1.8 and round(100 * (0.2 - emax * s), 1) == 16.7

# 4. Пример ESL 7.10.2: отбор признаков до CV против отбора внутри фолдов (10 прогонов).
def esl_run(seed, n=50, p=5000, top=100, k_folds=5):
    r = random.Random(seed)
    y = [0] * (n // 2) + [1] * (n // 2)
    X = [[r.gauss(0, 1) for _ in range(p)] for _ in range(n)]   # признаки не зависят от y
    def select(rows):
        ym = sum(y[i] for i in rows) / len(rows)
        score = []
        for j in range(p):
            col = [X[i][j] for i in rows]
            xm = sum(col) / len(col)
            cov = sum((x - xm) * (y[i] - ym) for x, i in zip(col, rows))
            score.append(abs(cov) / math.sqrt(sum((x - xm) ** 2 for x in col)))
        return sorted(range(p), key=lambda j: -score[j])[:top]
    order = list(range(n))
    r.shuffle(order)
    folds = [order[k::k_folds] for k in range(k_folds)]
    def cv_error(fixed):
        wrong = 0
        for test in folds:
            train = [i for i in order if i not in test]
            feats = fixed if fixed is not None else select(train)
            for t in test:
                nn = min(train, key=lambda i: sum((X[i][j] - X[t][j]) ** 2 for j in feats))
                wrong += y[nn] != y[t]
        return wrong / n
    return cv_error(select(list(range(n)))), cv_error(None)

runs = [esl_run(seed) for seed in range(10)]
wrong_way = sum(w for w, _ in runs) / len(runs)
right_way = sum(r for _, r in runs) / len(runs)
assert round(100 * wrong_way) == 2 and round(100 * right_way) == 54, (wrong_way, right_way)
print('validation: код из HTML, McNemar, шум hold-out, смещение отбора, пример ESL — OK; без моделей.')

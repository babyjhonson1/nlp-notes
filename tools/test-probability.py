"""Числа справочника reference/probability-information: только стандартная библиотека."""
import contextlib
import html
import io
import math
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
source = (root / 'sections/reference/probability-information.html').read_text()

# 1. Код из HTML: softmax, энтропия, cross-entropy, KL, градиент и log-sum-exp.
snippet = html.unescape(re.findall(r'<pre><code>(.*?)</code></pre>', source, re.S)[0])
namespace, output = {}, io.StringIO()
with contextlib.redirect_stdout(output):
    exec(compile(snippet, 'probability:first-example', 'exec'), namespace)
expected = [line[2:] for line in snippet.splitlines() if line.startswith('# ')]
assert output.getvalue().splitlines() == expected, output.getvalue()
q, p = namespace['q'], namespace['p']
assert round(-math.log(q[0]), 3) == 1.180                       # потеря на негативном отзыве
assert round(namespace['entropy'](p) / math.log(2), 2) == 1.30 and round(math.log(3), 3) == 1.099
assert [n / 20 for n in (12, 6, 2)] == p                         # MLE категориального = частоты

# 2. Численные утверждения раздела.
assert 0.1 ** 1000 == 0.0                                       # произведение вероятностей исчезает
math.exp(709)
try:
    math.exp(710)
    raise AssertionError('exp(710) должно переполнять float64')
except OverflowError:
    pass
lse = namespace['logsumexp']([1000, 999, 998])
assert [round(v - lse, 3) for v in (1000, 999, 998)] == [-0.408, -1.408, -2.408]
counts, k = [12, 6, 2, 0], 4                                    # сглаживание Лапласа = MAP при alpha=2
alpha = 2
assert [(c + alpha - 1) / (sum(counts) + k * (alpha - 1)) for c in counts] == [(c + 1) / (20 + k) for c in counts]

# 3. Рисунок prob-kl: гауссиана для смеси N(-2, 0.36) и N(2, 0.36) по двум направлениям KL.
def gpdf(x, m, s):
    return math.exp(-(x - m) ** 2 / (2 * s * s)) / (s * math.sqrt(2 * math.pi))

def mix(x):
    return 0.5 * gpdf(x, -2, 0.6) + 0.5 * gpdf(x, 2, 0.6)

xs, dx = [-8 + 16 * i / 3200 for i in range(3201)], 16 / 3200

def kl(f, g):
    total = 0.0
    for x in xs:
        fx = f(x)
        if fx > 1e-300:
            total += fx * (math.log(fx) - math.log(max(g(x), 1e-300))) * dx
    return total

fwd_s = math.sqrt(0.36 + 4)
forward = lambda m, s: kl(mix, lambda x: gpdf(x, m, s))
reverse = lambda m, s: kl(lambda x: gpdf(x, m, s), mix)
assert round(fwd_s, 2) == 2.09
assert all(forward(0, fwd_s) < forward(m, s) for m, s in ((0.2, fwd_s), (0, fwd_s * 1.05), (0, fwd_s * 0.95)))
best = min((reverse(m / 20, s / 100), m / 20, s / 100) for m in range(30, 51) for s in range(50, 81))
assert best[1:] == (2.0, 0.6), best
assert (round(forward(0, fwd_s), 2), round(forward(2, 0.6), 1)) == (0.56, 10.4)
assert (round(reverse(0, fwd_s), 2), round(reverse(2, 0.6), 2)) == (1.27, 0.69)
print('probability-information: код из HTML, численные утверждения, направления KL — OK; без моделей.')

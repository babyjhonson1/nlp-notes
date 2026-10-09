"""Арифметика справочника Adam/AdamW: только стандартная библиотека, без моделей."""
import contextlib
import html
import io
import math
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
source = (root / 'sections/reference/adam-adamw.html').read_text()
snippet = html.unescape(re.findall(r'<pre><code>(.*?)</code></pre>', source, re.S)[0])
namespace = {}
output = io.StringIO()
with contextlib.redirect_stdout(output):
    exec(compile(snippet, 'adam-adamw:first-example', 'exec'), namespace)
assert output.getvalue().splitlines() == ['[0.9, 0.9]', '[0.905263, 0.8]']
step = namespace['adamw_step']

def close(actual, expected):
    assert len(actual) == len(expected)
    assert all(math.isclose(a, b, rel_tol=1e-8, abs_tol=1e-8)
               for a, b in zip(actual, expected)), (actual, expected)

theta, m, v = step([1., 1.], [2., 20.], [0., 0.], [0., 0.], 1)
close(theta, [.9, .9])
close(m, [.2, 2.])
close(v, [.004, .4])
theta, m, v = step(theta, [-2., 20.], m, v, 2)
close(m, [-.02, 3.8])
close(v, [.007996, .7996])
close(theta, [.9052631579, .8])

# Первый шаг при нулевом градиенте ошибки: L2 в градиенте против отдельного decay.
decay, _, _ = step([1., 10.], [0., 0.], [0., 0.], [0., 0.], 1, weight_decay=.1)
l2, _, _ = step([1., 10.], [.1, 1.], [0., 0.], [0., 0.], 1)
close(decay, [.99, 9.9])
close(l2, [.9, 9.9])

# Без адаптивных шагов decay накапливается как произведение (1 - lr * lambda).
theta = [2.]
for t, lr in enumerate([.1, .05, .01], 1):
    theta, _, _ = step(theta, [0.], [0.], [0.], t, lr=lr, weight_decay=.2)
close(theta, [2. * math.prod(1 - lr * .2 for lr in [.1, .05, .01])])
print('Adam/AdamW: пример из HTML, статистики, L2/decay и накопление decay — OK; без моделей.')

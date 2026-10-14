"""Числа раздела ml/linear-models: только стандартная библиотека, без моделей."""
import contextlib
import html
import io
import math
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
source = (root / 'sections/ml/linear-models.html').read_text()

# 1. Код из HTML: градиентный спуск на примере со словом.
snippet = html.unescape(re.findall(r'<pre><code>(.*?)</code></pre>', source, re.S)[0])
namespace, output = {}, io.StringIO()
with contextlib.redirect_stdout(output):
    exec(compile(snippet, 'linear-models:first-example', 'exec'), namespace)
expected = [line[2:] for line in snippet.splitlines() if line.startswith('# ')]
assert output.getvalue().splitlines() == expected, output.getvalue()
fit, sigmoid = namespace['fit'], namespace['sigmoid']

# 2. MLE с одним бинарным признаком равен логарифмам шансов групп.
b, w = math.log(6 / 24), math.log(8 / 2) - math.log(6 / 24)
assert (round(b, 3), round(w, 3), round(math.exp(w), 6)) == (-1.386, 2.773, 16.0)
w_gd, b_gd = fit(neg_with=8, steps=5000)
assert abs(w_gd - w) < 1e-9 and abs(b_gd - b) < 1e-9
assert abs((10 * sigmoid(w_gd + b_gd) + 30 * sigmoid(b_gd)) / 40 - 14 / 40) < 1e-12   # средняя p = доля

# 3. Разделимые данные: вес растёт примерно на log 10 за десятикратное число шагов.
ws = [fit(neg_with=10, steps=s)[0] for s in (1000, 10000, 100000)]
assert all(abs((b2 - a2) - math.log(10)) < 0.1 for a2, b2 in zip(ws, ws[1:])), ws
assert round(math.log(10), 1) == 2.3

# 4. Дублированный признак: важна только сумма весов.
for w1, w2 in ((2.773, 0.0), (1.3865, 1.3865), (5.0, -2.227)):
    assert round(w1 + w2, 3) == 2.773

# 5. VIF для двух признаков и сравнение градиентов log-loss и MSE по логиту.
rho = 0.99
vif = 1 / (1 - rho ** 2)
assert round(vif) == 50 and round(math.sqrt(vif)) == 7
s = sigmoid(-5)
g_log, g_mse = s - 1, 2 * (s - 1) * s * (1 - s)
assert (round(g_log, 3), round(g_mse, 3), round(g_log / g_mse)) == (-0.993, -0.013, 75)
print('linear-models: код из HTML, MLE по группам, разделимость, VIF, градиенты — OK; без моделей.')

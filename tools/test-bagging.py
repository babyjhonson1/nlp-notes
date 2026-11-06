"""Арифметика ml/random-forest: стандартная библиотека, без обучения моделей."""
from fractions import Fraction as F
from html import unescape
from html.parser import HTMLParser
from itertools import combinations, product
from pathlib import Path
import re


class Tables(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tables = []
        self.table = self.row = self.cell = None

    def handle_starttag(self, tag, attrs):
        if tag == 'table':
            self.table = []
        elif tag == 'tr':
            self.row = []
        elif tag in ('td', 'th'):
            self.cell = []

    def handle_data(self, data):
        if self.cell is not None:
            self.cell.append(data)

    def handle_endtag(self, tag):
        if tag in ('td', 'th'):
            self.row.append(''.join(self.cell))
            self.cell = None
        elif tag == 'tr':
            self.table.append(self.row)
            self.row = None
        elif tag == 'table':
            self.tables.append(self.table)
            self.table = None


source = (Path(__file__).resolve().parents[1] / 'sections/ml/random-forest.html').read_text()
parser = Tables()
parser.feed(source)
tables = parser.tables

# Проверяем именно опубликованные наборы номеров и OOB-таблицу.
numbers = lambda s: list(map(int, re.findall(r'\d+', s)))
samples = []
for row in tables[0][1:]:
    chosen = numbers(row[1])
    assert len(chosen) == 10
    assert set(chosen) <= set(range(1, 11))
    assert len(set(chosen)) == numbers(row[2])[0]
    assert sorted(set(range(1, 11)) - set(chosen)) == numbers(row[3])
    samples.append(chosen)
for row in tables[4][1:]:
    order = int(row[0])
    allowed = [b for b, sample in enumerate(samples, 1) if order not in sample]
    assert allowed == numbers(row[1]), (order, allowed, row[1])

# Независимая проверка формулы уникальных: все возможные выборки при n=3.
n = 3
all_samples = list(product(range(n), repeat=n))
mean_unique = F(sum(len(set(s)) for s in all_samples), len(all_samples))
assert mean_unique == n * (1 - (1 - F(1, n)) ** n)
share10 = 1 - F(9, 10) ** 10
assert round(float(share10), 3) == 0.651
assert round(float(10 * share10), 2) == 6.51
assert round(1 - (1 - 1 / 100_000) ** 100_000, 3) == 0.632

# Вероятности берём из числителей и знаменателей в таблице листьев.
probabilities = []
for row in tables[1][1:]:
    a, b = numbers(row[1])[:2]
    probabilities.append(F(a, b))
assert sum(p > F(1, 2) for p in probabilities) == 2
mean_probability = sum(probabilities) / len(probabilities)
assert mean_probability == F(13, 30) < F(1, 2)
assert round(float(mean_probability), 3) == 0.433
assert F(2 + 4 + 3, 3) == 3

# Дисперсия среднего через сумму B диагональных и B(B-1) внедиагональных ковариаций.
rho = F(3, 10)
for row in tables[2][1:4]:
    b = numbers(row[0])[0]
    covariance_sum = b + b * (b - 1) * rho
    variance = covariance_sum / b ** 2
    common, reducible, stated = [F(c.strip(r'\()')) for c in row[1:]]
    assert variance == rho + (1 - rho) / b
    assert common == rho and reducible == (1 - rho) / b
    assert stated == variance == common + reducible
assert F(10 + 10 * 9, 10 ** 2) == 1  # одинаковые прогнозы: rho=1
assert F(10, 10 ** 2) == F(1, 10)   # некоррелированные: rho=0

feature_sets = list(combinations(range(4), 2))
assert F(sum(0 in s for s in feature_sets), len(feature_sets)) == F(1, 2)
assert (F(1, 5) + F(3, 5)) / 2 == F(2, 5)  # условный OOB-прогноз
assert round(300 * (1 - 1 / 10000) ** 10000) == 110
assert F(32, 100) - F(20, 100) == F(12, 100)
assert F(23, 100) - F(20, 100) == F(3, 100)

# SHAP для долгой задержки и высокого рейтинга на равномерном фоне.
background = next(table for table in tables if table[0] == [
    'Задержка', 'Обычный рейтинг', 'Высокий рейтинг',
])
short, long = [[F(c.strip(r'\()')) for c in row[1:]] for row in background[1:]]
baseline = sum(short + long) / 4
delay, rating = sum(long) / 2, (short[1] + long[1]) / 2
prediction = long[1]
assert (baseline, delay, rating, prediction) == tuple(map(F, ('0.30', '0.52', '0.22', '0.40')))
delay_shap = ((delay - baseline) + (prediction - rating)) / 2
rating_shap = ((rating - baseline) + (prediction - delay)) / 2
assert (delay_shap, rating_shap) == (F('0.20'), F('-0.10'))
assert baseline + delay_shap + rating_shap == prediction

# Только компиляция примера, без его исполнения и импорта scikit-learn.
code = re.findall(r'<pre><code>(.*?)</code></pre>', source, re.S)
for snippet in code:
    compile(unescape(snippet), 'random-forest:sklearn-example', 'exec')
print('Бэггинг: таблицы, бутстрэп, усреднение, дисперсия, OOB, SHAP и синтаксис примера — OK. Обучение не запускалось.')

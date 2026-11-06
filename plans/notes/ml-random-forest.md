# Бэггинг и случайный лес: источники и проверка

Дата сверки: 2026-11-04. Раздел: `ml/random-forest`.

## Источники

- Breiman, [Bagging Predictors](https://doi.org/10.1007/BF00058655), 1996; [авторский технический отчёт 1994 года](https://www.stat.berkeley.edu/~breiman/bagging.pdf) — бутстрэп, усреднение регрессоров, голосование классификаторов, роль неустойчивости.
- Breiman, [Random Forests](https://www.stat.berkeley.edu/~breiman/randomforest2001.pdf), 2001 — выбор признаков в узлах, зависимость деревьев и их сила, сходимость ошибки при увеличении леса, OOB. Корреляция в простой формуле дисперсии раздела — корреляция числовых прогнозов при фиксированном объекте и повторном обучении; это не специальная корреляция margin из классификационной границы Breiman.
- Geurts, Ernst, Wehenkel, [Extremely Randomized Trees](https://orbi.uliege.be/bitstream/2268/9357/1/geurts-mlj-advance.pdf), 2006, §2.1 — случайный порог на признак, лучший из случайных кандидатов, полная выборка вместо бутстрэпа.
- Lundberg & Lee, [A Unified Approach to Interpreting Model Predictions](https://arxiv.org/abs/1705.07874), 2017. Lundberg, Erion & Lee, [Consistent Individualized Feature Attribution for Tree Ensembles](https://arxiv.org/abs/1802.03888), 2018. Аддитивные вклады и TreeSHAP.
- Дополнение от 2026-11-06. Формула через равномерное среднее прибавок по порядкам сверена по §2 [Sundararajan и Najmi (2020)](https://proceedings.mlr.press/v119/sundararajan20b/sundararajan20b.pdf). Усреднение прогнозов после подстановки фоновых строк соответствует интервенционному варианту. [Chen et al. (2020)](https://arxiv.org/abs/2006.16234).
- Документация scikit-learn **1.9.1**: [RandomForestClassifier](https://scikit-learn.org/1.9/modules/generated/sklearn.ensemble.RandomForestClassifier.html), [RandomForestRegressor](https://scikit-learn.org/1.9/modules/generated/sklearn.ensemble.RandomForestRegressor.html), [ExtraTreesClassifier](https://scikit-learn.org/1.9/modules/generated/sklearn.ensemble.ExtraTreesClassifier.html), [permutation importance](https://scikit-learn.org/1.9/modules/permutation_importance.html), [коррелированные признаки](https://scikit-learn.org/1.9/auto_examples/inspection/plot_permutation_importance_multicollinear.html). Сверены значения `max_features`, усреднение вероятностей, условия OOB, `oob_score_`, `oob_decision_function_`, `classes_` и интерфейс перестановочной важности.

## Числа и границы проверки

Все примеры условные; измерений качества моделей нет. Номера заказов соответствуют таблице `ml/trees`; три набора повторов используются только как примеры бутстрэпа. Деревья по ним в этом разделе не обучались. Пример листовых вероятностей, OOB-ответы и изменения ошибки после перестановки заданы для арифметического объяснения, не получены экспериментально.

`python3 tools/test-bagging.py` проверяет непосредственно таблицы HTML: длины бутстрэп-выборок, уникальные и отсутствующие номера, допустимые OOB-деревья. Также проверяет долю уникальных объектов (включая полный перебор маленького случая), усреднение вероятностей против голосования, формулу дисперсии через сумму ковариаций и остальные числовые примеры. Используется только стандартная библиотека, без обучения деревьев или других моделей. Python-фрагмент scikit-learn проверяется только на синтаксис; обучение, перестановочная оценка и загрузка датасетов не запускались.

В раскрываемом примере SHAP прогнозы для четырёх сочетаний признаков заданы условно. Скрипт читает их из таблицы, пересчитывает значения для известных наборов признаков и оба вклада точными дробями.

Браузерная проверка остаётся пользователю. Проверить навигацию, MathJax, таблицы и код на узком экране, раскрытие примера SHAP и кнопку «Свернуть».

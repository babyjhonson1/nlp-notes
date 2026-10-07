# BGE: происхождение чисел и проверки (2026-10-07)

Модели не запускались. Проверки — по статьям, model card, конфигурациям (небольшие JSON), исходному коду FlagEmbedding и sentence-transformers 6.1.0 и одному токенизатору BGE-M3 (`tokenizer.json`, 17 МБ, без весов).

## Источники

- C-Pack (arXiv 2309.07597, SIGIR 2024): рецепт из трёх этапов, C-MTP (100 млн слабых пар после фильтра Text2Vec-Chinese с порогом 0.43; 838 465 размеченных), батч 19 200, абляции таблиц 3–4 (китайская large, C-MTEB): pretrain 59.00 / без RetroMAE 58.62 (поиск 63.90 / 62.56), без инструкций 63.40 / с ними 63.96, батч 256/2048/19 200 → поиск 57.25/60.96/63.90. Английские модели — «тем же рецептом», состав данных не приведён.
- RetroMAE (arXiv 2205.12035): маски 15–30% и 50–70% (по умолчанию 0.3/0.5), однослойный декодер, улучшенное декодирование, MLM кодировщика сохраняется.
- BGE-M3 (arXiv 2402.03216): формулы трёх оценок, s_inter = 1·dense + 0.3·lex + 1·mul, λ = (1, 0.1, 1), L_final = (L + L′)/2; данные таблиц 7–8 (1,2 млрд пар, 194 языка, 2655 языковых пар; дообучение ≈ 1,6 млн, MultiLongDoc 41 434 в 13 языках); приложение B (RetroMAE 184 млн текстов, 105 языков, 8192; слабые пары 512/8192, lr 5e-5, 25 тыс. шагов; 7 негативов, ≈6000 шагов разогрева; батчи таблицы 9; split-batch ×20 на 8192); таблицы 1, 3, 5, 6 (MIRACL, MLDR, абляции).
- model card bge-base-en-v1.5 и FlagEmbedding README: инструкция для английских моделей, температура 0.01 и диапазон [0.6, 1] у v1, v1.5 «alleviate similarity distribution» (12.09.2023), bge-large-zh-v1.5 — слияние двух дообученных копий (lr 1e-5, 5 эпох, train_group_size 2).
- model card BGE-M3: инструкция не нужна; пример compute_score (use_fp16=True, max_passage_length=128): q1–p1 dense 0.62598, sparse 0.19556, colbert 0.77965, сумма с весами (0.4, 0.2, 0.4) 0.60136; q1–p2 0.34741 / 0.0087967 / 0.46215 / 0.32558; веса токенов запроса What 0.08356, is 0.0814, B 0.1296, GE 0.252, M 0.1702, 3 0.2695, ? 0.04092.
- Конфигурации: bge-*-en-v1.5 — BertModel, CLS-пулинг + Normalize, max_seq_length 512, do_lower_case; bge-m3 — XLMRobertaModel, 24 слоя, 1024, словарь 250 002, max_position_embeddings 8194, max_seq_length 8192, промптов нет. Параметры: small 33 360 000, base 109 482 240, large 335 141 888 (метаданные весов); bge-m3 ≈ 567,75 млн по конфигурации, сходится с pytorch_model.bin 2 271 145 830 байт в fp32; colbert_linear.pt 2,1 МБ (1024×1024 в fp16), sparse_linear.pt — Linear(1024, 1).

## Код

- FlagEmbedding `inference/embedder/encoder_only/m3.py`: query/passage_max_length по умолчанию 512; colbert_score = сумма максимумов / число векторов запроса; лексические веса — max по повторам, служебные токены исключены; compute_score делит на сумму весов.
- FlagEmbedding `finetune/embedder/encoder_only/m3/modeling.py`: ReLU(sparse_linear), colbert_linear по hidden[:, 1:], ensemble = dense + 0.3·sparse + colbert, loss = (dense + ensemble + 0.1·sparse + colbert)/4, самодистилляция от softmax(ensemble.detach()), затем /2.
- sentence-transformers 6.1.0: у SentenceTransformer по умолчанию prompts {"query": None, "document": None}; MultiVectorEncoder для bge-m3 идёт через `_load_converted_modules` (предупреждение о конвертации, случайная проекция 1024→128 с сообщением info); поддержки голов BGE-M3 нет.

## Токенизатор BGE-M3

«What is BGE M3?» → `<s> ▁What ▁is ▁B GE ▁M 3 ? </s>`; общие токены с описанием BGE-M3 — is, B, GE, M, 3; с описанием BM25 — только is (BM25 → ▁BM 25). «почта» → `▁почта`, «почту» → `▁поч ту`.

## Схема `bge-flow`

Режим «Три выхода» — числа model card (константы `DOCS`, `LEX` в `figures/bge.js`). Режим «Самодистилляция» — условные оценки `SC` (dense 5.1/4.8/3.2/1.0, lex 2.6/2.7/0.6/0.2, mul 5.4/4.9/3.0/1.2); L, L′ и итог считаются в коде.

## Пояснение о XLM-R (добавлено 2026-10-07)

Абзац в «Архитектуре» (и короткая вставка в E5) — по статье Conneau et al., arXiv 1911.02116 (ar5iv): MLM только на одноязычных данных, без языковых эмбеддингов; SentencePiece unigram, словарь 250K; выборка языков как у XLM с α = 0.3; CC-100 — более 2 ТБ CommonCrawl на 100 языках, язык определён fastText и внутренним классификатором, документы отфильтрованы языковыми моделями каждого языка; «We follow the XLM approach as closely as possible». Model card FacebookAI/xlm-roberta-large: «multilingual version of RoBERTa», 2,5 ТБ. Рецепт RoBERTa — Liu et al., arXiv 1907.11692. Деление русского на слова и части — по проверке токенизатора выше; «почти по буквам» у английского WordPiece — по проверке из карточки E5/SBERT.

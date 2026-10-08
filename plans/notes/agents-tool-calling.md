# Вызов инструментов: источники и проверка

Дата: 2026-10-08. Раздел `agents/tool-calling`.

## Первоисточники

- Шаблоны чата из `tokenizer_config.json` чекпойнтов Qwen/Qwen3-4B-Instruct-2507, Qwen/Qwen3-8B, Qwen/Qwen2.5-7B-Instruct и Qwen/Qwen3-Coder-30B-A3B-Instruct (Hugging Face, скачаны 2026-10-08, только конфигурации и токенизатор, без весов). Из них: формат `<tool_call>` с JSON, описания в `<tools>`, результаты `tool` в ходе `user` с `<tool_response>`, отсутствие идентификаторов вызова в тексте; XML-формат Qwen3-Coder. `added_tokens_decoder`: `<tool_call>` 151657, `</tool_call>` 151658, `<tool_response>` 151665/151666, `special: false`. `generation_config.json`: стоп-токены 151645 (`<|im_end|>`) и 151643.
- [Qwen: Function Calling](https://qwen.readthedocs.io/en/latest/framework/function_call.html): рекомендация Hermes-формата для Qwen3, команда vLLM с `--tool-call-parser hermes`, предупреждение о неразобранных вызовах.
- [vLLM Tool Calling](https://docs.vllm.ai/en/stable/features/tool_calling/), проверено 2026-10-08: режимы `tool_choice`, structured outputs для named/required, `strict: true` и structural tags в auto, парсеры `hermes` и `qwen3_xml`, цитата о гарантии разбора. Исходник `vllm/tool_parsers/hermes_tool_parser.py` на теге v0.31.0 (релиз 2026-10-05): регулярное выражение по тегам, `json.loads`, имена не сверяются с `tools`, при исключении весь текст возвращается как `content`.
- TRL 1.14.2: [SFT Trainer](https://huggingface.co/docs/trl/sft_trainer) — `assistant_only_loss` (по умолчанию `False`), пометки `{% generation %}`, автоматическая подстановка шаблона для Qwen3, колонка `tools`, среднее по немаскированным токенам; `trl/chat_templates/qwen3_instruct_2507_training.jinja` и README каталога (формат Llama 3.1 с `parameters`).
- [Hugging Face: Writing a chat template](https://huggingface.co/docs/transformers/main/en/chat_templating_writing): формат инструментов задаётся обучением модели.
- Toolformer, [arXiv HTML v1](https://arxiv.org/html/2302.04761v1), раздел 2 и 4.1: формулы \(L_i\), \(L_i^{\pm}\), веса \(\max(0, 1-0.2t)\), пороги \(\tau_s=0.05\), \(\tau_f=1\) (калькулятор и перевод: \(\tau_s=0\), \(\tau_f=0.5\)), вызов префиксом при фильтрации, один вызов на вход при генерации, GPT-J.
- ToolLLM, [arXiv 2307.16789](https://arxiv.org/abs/2307.16789): 16 464 REST API из RapidAPI, ChatGPT для заданий и путей решения, ToolLLaMA, нейросетевой поиск API; ICLR 2024 — по [материалам конференции](https://proceedings.iclr.cc/paper_files/paper/2024/hash/28e50ee5b72e90b50e7196fde8ea260e-Abstract-Conference.html).
- Park et al., [Grammar-Aligned Decoding](https://arxiv.org/abs/2405.21047), NeurIPS 2024: искажение распределения при пошаговой маске. Willard, Louf, [arXiv 2307.09702](https://arxiv.org/abs/2307.09702): переход к конечному автомату и индекс по словарю для регулярных выражений и КС-грамматик.
- Anthropic: [Define tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools) (системный промпт из описаний, рекомендации к описаниям, `tool_choice` auto/any/tool/none, prefill при any/tool), [Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents) (2025-09-11), сведения о `strict`, `defer_loading` и возврате всех результатов одним сообщением — из официальной документации Claude API.
- OpenAI: [Function calling](https://developers.openai.com/api/docs/guides/function-calling) — `tool_choice`, требования `strict`, «меньше 20 функций», описания попадают в системное сообщение.

## Локальные расчёты

Траектория из текста отрендерена шаблоном Qwen3-4B-Instruct-2507 (Jinja с `tojson` как в transformers) и токенизирована `tokenizers` 0.23.2 по `tokenizer.json` чекпойнта: 792 токена; маска шаблона TRL с `{% generation %}` — 88; системный ход 531, из них описания инструментов 352, правила 103; первый запрос 554; шаги иллюстрации 554 → 576 → 668 → 689 → 749 → 791; сгенерировано 22 + 21 + 42. Результат поиска инструкции: 80 токенов с `ensure_ascii=False`, 692 с экранированием. Тексты обучающего шаблона TRL и исходного шаблона для этой траектории совпали.

## Границы проверки

Python-блоки раздела извлечены из HTML с декодированием сущностей и собраны с кодом первого раздела; Python 3.13.2, openai 3.26.1, jsonschema 4.26.0. Учебный прогон даёт `completed 4` и указанное сообщение; при `max_steps=3` — `step_limit`. Адаптер проверен через настоящий клиент `openai` против локального HTTP-сервера с заранее записанными ответами в формате Chat Completions: штатная траектория, ошибка enum с исправлением, `ask_user` с корректными и неполными аргументами, неизвестное имя, лишнее поле, короткий запрос, не-объект в аргументах, тайм-аут инструмента, предел решений, `finish_reason="length"`, тег в тексте, пустой ответ, два вызова, не-JSON в аргументах. Сообщения третьего запроса, отрендеренные шаблоном, совпали с текстом траектории иллюстрации.

Иллюстрация проверена в jsdom: шесть шагов, переключение режимов, блокировка кнопок, счётчики, экранирование, снятие обработчиков. `node --check` для всех `assets/*.js` и `figures/*.js`. Визуальное расположение и тёмная тема не проверялись.

Модель и vLLM не запускались, веса не скачивались. Поведение настоящей модели (частота неразобранных вызовов, реакция на сообщения об ошибках) не измерялось.

/* agents/tool-calling: траектория в шаблоне чата Qwen3-4B-Instruct-2507, без вызовов модели.
   Тексты сокращены там, где стоит «…»; числа токенов посчитаны токенизатором чекпойнта для полного текста. */

const TC_SEGMENTS = [
  { step: 0, src: "tpl", text: "<|im_start|>system\n" },
  { step: 0, src: "dev", text: "Ты помогаешь диагностировать ошибки доступа к корпоративному порталу. … Если продолжить нельзя, вызови ask_user и перечисли недостающие сведения." },
  { step: 0, src: "tpl", text: "\n\n# Tools\n\nYou may call one or more functions to assist with the user query.\n\nYou are provided with function signatures within <tools></tools> XML tags:\n<tools>" },
  { step: 0, src: "dev", text: "\n{\"type\": \"function\", \"function\": {\"name\": \"search_instruction\", \"description\": \"Ищет инструкцию во внутренней базе…\", \"parameters\": {… \"query\" …}}}" },
  { step: 0, src: "dev", text: "\n{\"type\": \"function\", \"function\": {\"name\": \"get_service_status\", \"description\": \"Читает страницу статуса…\", \"parameters\": {… \"enum\": [\"auth\", \"portal\", \"sso\"] …}}}" },
  { step: 0, src: "dev", text: "\n{\"type\": \"function\", \"function\": {\"name\": \"ask_user\", \"description\": \"Завершает запуск…\", \"parameters\": {… \"message\" …}}}" },
  { step: 0, src: "tpl", text: "\n</tools>\n\nFor each function call, return a json object with function name and arguments within <tool_call></tool_call> XML tags:\n<tool_call>\n{\"name\": <function-name>, \"arguments\": <args-json-object>}\n</tool_call><|im_end|>\n<|im_start|>user\n" },
  { step: 0, src: "user", text: "При входе в портал получаю ACCESS_CHECK_FAILED. Что делать?" },
  { step: 0, src: "tpl", text: "<|im_end|>\n<|im_start|>assistant\n" },
  { step: 1, src: "model", loss: true, text: "<tool_call>\n{\"name\": \"search_instruction\", \"arguments\": {\"query\": \"ACCESS_CHECK_FAILED\"}}\n</tool_call><|im_end|>" },
  { step: 2, src: "tpl", text: "\n<|im_start|>user\n<tool_response>\n" },
  { step: 2, src: "tool", text: "{\"ok\": true, \"data\": {\"found\": true, \"id\": \"access-17\", \"text\": \"ACCESS_CHECK_FAILED: проверка доступа не завершилась. Проверьте статус auth. …\"}}" },
  { step: 2, src: "tpl", text: "\n</tool_response><|im_end|>\n<|im_start|>assistant\n" },
  { step: 3, src: "model", loss: true, text: "<tool_call>\n{\"name\": \"get_service_status\", \"arguments\": {\"service\": \"auth\"}}\n</tool_call><|im_end|>" },
  { step: 4, src: "tpl", text: "\n<|im_start|>user\n<tool_response>\n" },
  { step: 4, src: "tool", text: "{\"ok\": true, \"data\": {\"known\": true, \"service\": \"auth\", \"status\": \"incident\", \"details\": \"Проверки доступа завершаются по тайм-ауту.\"}}" },
  { step: 4, src: "tpl", text: "\n</tool_response><|im_end|>\n<|im_start|>assistant\n" },
  { step: 5, src: "model", loss: true, text: "Инцидент auth может объяснять ошибку. Дождитесь восстановления и повторите вход; если ошибка сохранится, пришлите подробный текст и время.<|im_end|>" }
];

const TC_API = [
  { step: 0, role: "system", body: "Правила диагностики" },
  { step: 0, role: "tools", body: "search_instruction, get_service_status, ask_user — JSON Schema каждой функции" },
  { step: 0, role: "user", body: "При входе в портал получаю ACCESS_CHECK_FAILED. Что делать?" },
  { step: 1, role: "assistant", body: "tool_calls: search_instruction, arguments = '{\"query\": \"ACCESS_CHECK_FAILED\"}'", meta: "finish_reason: \"tool_calls\" → адаптер: Call", id: "call-1" },
  { step: 2, role: "tool", body: "{\"ok\": true, \"data\": {\"found\": true, \"id\": \"access-17\", …}}", id: "call-1" },
  { step: 3, role: "assistant", body: "tool_calls: get_service_status, arguments = '{\"service\": \"auth\"}'", meta: "finish_reason: \"tool_calls\" → адаптер: Call", id: "call-2" },
  { step: 4, role: "tool", body: "{\"ok\": true, \"data\": {… \"status\": \"incident\" …}}", id: "call-2" },
  { step: 5, role: "assistant", body: "content: «Инцидент auth может объяснять ошибку…»", meta: "finish_reason: \"stop\" → адаптер: Finish(completed)" }
];

const TC_STEPS = [
  { title: "Запрос 1: промпт собран", context: 554, generated: 0,
    say: "Сервер применил шаблон чата к сообщениям и полю <code>tools</code>. Описания инструментов стали частью системного хода: 352 из 554 токенов. Последняя строка — заготовка хода ассистента, дальше пишет модель." },
  { title: "Модель сгенерировала вызов", context: 576, generated: 22,
    say: "Модель начала ответ токеном <code>&lt;tool_call&gt;</code> и дописала JSON вызова. <code>&lt;|im_end|&gt;</code> — стоп-токен: генерация окончена. Парсер <code>hermes</code> нашёл теги, разобрал JSON и вернул клиенту <code>tool_calls</code>. Идентификатор вызова ведёт исполнитель; в шаблоне Qwen он в токены не попадает." },
  { title: "Код вернул результат", context: 668, generated: 22,
    say: "Исполнитель проверил вызов, выполнил <code>search_instruction</code> и отправил результат сообщением роли <code>tool</code>. Шаблон обернул его в <code>&lt;tool_response&gt;</code> внутри хода <code>user</code> и снова добавил заготовку ответа. Эти 92 токена написала не модель." },
  { title: "Модель сгенерировала второй вызов", context: 689, generated: 43,
    say: "Второе решение принимается по контексту, где уже есть инструкция, поэтому модель вызывает <code>get_service_status</code> с <code>service = auth</code>. Без кеша префикса сервер заново обработал бы все 668 токенов контекста." },
  { title: "Код вернул результат", context: 749, generated: 43,
    say: "Результат проверки статуса — зарегистрированный инцидент — добавлен так же, как первый: текстом в ходе <code>user</code>." },
  { title: "Модель ответила текстом", context: 791, generated: 85,
    say: "Ответ начинается не с <code>&lt;tool_call&gt;</code>, а с обычного текста. Сервер возвращает <code>content</code> и <code>finish_reason</code> «stop»; адаптер превращает это в <code>Finish(completed)</code>. Из 791 токена контекста модель написала 85." }
];

const TC_TRAIN = {
  title: "Обучение: вся траектория за один проход",
  say: "При обучении траектория подаётся целиком: результаты инструментов уже записаны, генерации и исполнения нет. Потеря считается только на ходах ассистента — 88 из 792 токенов с учётом перевода строки после <code>&lt;|im_end|&gt;</code>. Остальные токены не предсказываются, но остаются условием для следующих позиций."
};

const TC_ROLES = { system: "system", tools: "поле tools", user: "user", assistant: "assistant", tool: "tool" };

const TC_LABELS = { tpl: "разметка шаблона", dev: "правила и описания инструментов", user: "вопрос пользователя", model: "сгенерировано моделью", tool: "результат, вставленный кодом" };

function tcPlural(n, one, few, many){
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
  return many;
}

function tcMarkup(text){
  return escapeHtml(text).replace(/&lt;(\|im_start\||\|im_end\||\/?tool_call|\/?tool_response)&gt;/g, '<span class="tc-tok">$&</span>');
}

function mountTcStream(box){
  let mode = "gen";
  let step = 0;
  box.innerHTML = `
    <div class="fig-stage tc-stage">
      <div class="tc-heading"><b data-title></b><span data-count></span></div>
      <div class="tc-grid">
        <section class="tc-panel">
          <h3>Токены, которые видит модель</h3>
          <div class="tc-stream" data-stream tabindex="0" aria-label="Последовательность токенов"></div>
        </section>
        <section class="tc-panel">
          <h3>Сообщения API, которые видит код</h3>
          <ol class="tc-api" data-api></ol>
        </section>
      </div>
    </div>
    <div class="fig-row">
      <div class="fig-tabs" role="tablist" aria-label="Режим">
        <button type="button" role="tab" data-mode="gen">Генерация</button>
        <button type="button" role="tab" data-mode="train">Обучение</button>
      </div>
      <button type="button" class="fig-btn icon" data-prev aria-label="Предыдущий шаг">${ICON.prev}</button>
      <button type="button" class="fig-btn" data-next>Далее ${ICON.next}</button>
      <button type="button" class="fig-btn" data-reset>В начало</button>
      <span class="fig-status" data-position></span>
    </div>
    <p class="fig-say" aria-live="polite"></p>
    <div class="fig-legend">${legend(Object.entries(TC_LABELS).map(([src, text]) => [`<i class="tc-key tc-${src}"></i>`, text]))}<span><i class="tc-key tc-tok-key"></i>служебный токен</span><span data-loss-key hidden><i class="tc-key tc-loss-key"></i>токены с потерей при обучении</span></div>`;

  const get = selector => box.querySelector(selector);
  const stream = get("[data-stream]");
  const prev = get("[data-prev]");
  const next = get("[data-next]");
  const reset = get("[data-reset]");
  const tabs = [...box.querySelectorAll("[data-mode]")];

  const render = () => {
    const train = mode === "train";
    const last = train ? TC_STEPS.length - 1 : step;
    stream.classList.toggle("tc-train", train);
    stream.innerHTML = TC_SEGMENTS.filter(s => s.step <= last).map(s => {
      const cls = ["tc-s", `tc-${s.src}`];
      if (s.loss) cls.push("tc-loss");
      if (!train && s.step === step && step > 0) cls.push("tc-new");
      return `<span class="${cls.join(" ")}">${tcMarkup(s.text)}</span>`;
    }).join("");
    get("[data-api]").innerHTML = TC_API.filter(m => m.step <= last).map(m => {
      const fresh = !train && m.step === step && step > 0 ? " tc-new-item" : "";
      const id = m.id ? `<span class="tc-id">${m.id}</span>` : "";
      const meta = m.meta ? `<span class="tc-meta">${escapeHtml(m.meta)}</span>` : "";
      return `<li class="tc-msg tc-role-${m.role}${fresh}"><b>${TC_ROLES[m.role]}</b>${id}<code>${escapeHtml(m.body)}</code>${meta}</li>`;
    }).join("");
    if (train){
      get("[data-title]").textContent = TC_TRAIN.title;
      get("[data-count]").textContent = "792 токена · с потерей: 88 (11%)";
      get(".fig-say").innerHTML = TC_TRAIN.say;
      get("[data-position]").textContent = "Вся траектория";
      stream.scrollTop = 0;
    } else {
      const cur = TC_STEPS[step];
      get("[data-title]").textContent = cur.title;
      get("[data-count]").textContent = `Контекст: ${cur.context} ${tcPlural(cur.context, "токен", "токена", "токенов")} · сгенерировано моделью: ${cur.generated}`;
      get(".fig-say").innerHTML = cur.say;
      get("[data-position]").textContent = `Шаг ${step + 1} из ${TC_STEPS.length}`;
      stream.scrollTop = step === 0 ? 0 : stream.scrollHeight;
    }
    for (const tab of tabs) tab.setAttribute("aria-selected", String(tab.dataset.mode === mode));
    get("[data-loss-key]").hidden = !train;
    prev.disabled = train || step === 0;
    next.disabled = train || step === TC_STEPS.length - 1;
    reset.disabled = train || step === 0;
  };
  const onPrev = () => { step--; render(); };
  const onNext = () => { step++; render(); };
  const onReset = () => { step = 0; render(); };
  const onTab = event => { mode = event.currentTarget.dataset.mode; render(); };
  prev.addEventListener("click", onPrev);
  next.addEventListener("click", onNext);
  reset.addEventListener("click", onReset);
  for (const tab of tabs) tab.addEventListener("click", onTab);
  render();
  return () => {
    prev.removeEventListener("click", onPrev);
    next.removeEventListener("click", onNext);
    reset.removeEventListener("click", onReset);
    for (const tab of tabs) tab.removeEventListener("click", onTab);
  };
}

Object.assign(FIGURES, {
  "tc-stream": mountTcStream
});

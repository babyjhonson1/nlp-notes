/* agents/trajectory-training: траектория в шаблоне чата Qwen3-4B-Instruct-2507, без вызовов модели.
   Тексты сокращены там, где стоит «…»; числа токенов посчитаны токенизатором чекпойнта для полного текста. */

const ATT_SEGMENTS = [
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

const ATT_API = [
  { step: 0, role: "system", body: "Правила диагностики" },
  { step: 0, role: "tools", body: "search_instruction, get_service_status, ask_user — JSON Schema каждой функции" },
  { step: 0, role: "user", body: "При входе в портал получаю ACCESS_CHECK_FAILED. Что делать?" },
  { step: 1, role: "assistant", body: "tool_calls: search_instruction, arguments = '{\"query\": \"ACCESS_CHECK_FAILED\"}'", meta: "finish_reason: \"tool_calls\" → адаптер: Call", id: "call-1" },
  { step: 2, role: "tool", body: "{\"ok\": true, \"data\": {\"found\": true, \"id\": \"access-17\", …}}", id: "call-1" },
  { step: 3, role: "assistant", body: "tool_calls: get_service_status, arguments = '{\"service\": \"auth\"}'", meta: "finish_reason: \"tool_calls\" → адаптер: Call", id: "call-2" },
  { step: 4, role: "tool", body: "{\"ok\": true, \"data\": {… \"status\": \"incident\" …}}", id: "call-2" },
  { step: 5, role: "assistant", body: "content: «Инцидент auth может объяснять ошибку…»", meta: "finish_reason: \"stop\" → адаптер: Finish(completed)" }
];

const ATT_STEPS = [
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

const ATT_TRAIN = {
  title: "Обучение: вся траектория за один проход",
  say: "При обучении траектория подаётся целиком: результаты инструментов уже записаны, генерации и исполнения нет. Потеря считается только на ходах ассистента — 88 из 792 токенов с учётом перевода строки после <code>&lt;|im_end|&gt;</code>. На остальных токенах прямая потеря исключена, но они остаются условием для следующих позиций."
};

const ATT_ROLES = { system: "system", tools: "поле tools", user: "user", assistant: "assistant", tool: "tool" };

const ATT_LABELS = { tpl: "разметка шаблона", dev: "правила и описания инструментов", user: "вопрос пользователя", model: "сгенерировано моделью", tool: "результат, вставленный кодом" };

function attPlural(n, one, few, many){
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
  return many;
}

function attMarkup(text){
  return escapeHtml(text).replace(/&lt;(\|im_start\||\|im_end\||\/?tool_call|\/?tool_response)&gt;/g, '<span class="att-tok">$&</span>');
}

function mountAttStream(box){
  let mode = "gen";
  let step = 0;
  box.innerHTML = `
    <div class="fig-stage att-stage">
      <div class="att-heading"><b data-title></b><span data-count></span></div>
      <div class="att-grid">
        <section class="att-panel">
          <h3>Токены, которые видит модель</h3>
          <div class="att-stream" data-stream tabindex="0" aria-label="Последовательность токенов"></div>
        </section>
        <section class="att-panel">
          <h3>Сообщения API, которые видит код</h3>
          <ol class="att-api" data-api></ol>
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
    <div class="fig-legend">${legend(Object.entries(ATT_LABELS).map(([src, text]) => [`<i class="att-key att-${src}"></i>`, text]))}<span><i class="att-key att-tok-key"></i>служебный токен</span><span data-loss-key hidden><i class="att-key att-loss-key"></i>токены с потерей при обучении</span></div>`;

  const get = selector => box.querySelector(selector);
  const stream = get("[data-stream]");
  const prev = get("[data-prev]");
  const next = get("[data-next]");
  const reset = get("[data-reset]");
  const tabs = [...box.querySelectorAll("[data-mode]")];

  const render = () => {
    const train = mode === "train";
    const last = train ? ATT_STEPS.length - 1 : step;
    stream.classList.toggle("att-train", train);
    stream.innerHTML = ATT_SEGMENTS.filter(s => s.step <= last).map(s => {
      const cls = ["att-s", `att-${s.src}`];
      if (s.loss) cls.push("att-loss");
      if (!train && s.step === step && step > 0) cls.push("att-new");
      return `<span class="${cls.join(" ")}">${attMarkup(s.text)}</span>`;
    }).join("");
    get("[data-api]").innerHTML = ATT_API.filter(m => m.step <= last).map(m => {
      const fresh = !train && m.step === step && step > 0 ? " att-new-item" : "";
      const id = m.id ? `<span class="att-id">${m.id}</span>` : "";
      const meta = m.meta ? `<span class="att-meta">${escapeHtml(m.meta)}</span>` : "";
      return `<li class="att-msg att-role-${m.role}${fresh}"><b>${ATT_ROLES[m.role]}</b>${id}<code>${escapeHtml(m.body)}</code>${meta}</li>`;
    }).join("");
    if (train){
      get("[data-title]").textContent = ATT_TRAIN.title;
      get("[data-count]").textContent = "792 токена · с потерей: 88 (11%)";
      get(".fig-say").innerHTML = ATT_TRAIN.say;
      get("[data-position]").textContent = "Вся траектория";
      stream.scrollTop = 0;
    } else {
      const cur = ATT_STEPS[step];
      get("[data-title]").textContent = cur.title;
      get("[data-count]").textContent = `Контекст: ${cur.context} ${attPlural(cur.context, "токен", "токена", "токенов")} · сгенерировано моделью: ${cur.generated}`;
      get(".fig-say").innerHTML = cur.say;
      get("[data-position]").textContent = `Шаг ${step + 1} из ${ATT_STEPS.length}`;
      stream.scrollTop = step === 0 ? 0 : stream.scrollHeight;
    }
    for (const tab of tabs) tab.setAttribute("aria-selected", String(tab.dataset.mode === mode));
    get("[data-loss-key]").hidden = !train;
    prev.disabled = train || step === 0;
    next.disabled = train || step === ATT_STEPS.length - 1;
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

/* ---------- Toolformer: шесть шагов разметки для одной фразы ----------
   Вероятности, кандидаты и потери условные (не от модели); взвешенные потери
   подобраны так, чтобы быть точными до сотых. */

const ATT_TF_TOKENS = ["Ошибка", "ACCESS_CHECK_FAILED", "означает", ",", "что", "проверка", "доступа", "не", "завершилась", "."];
const ATT_TF_P = [0.001, 0.02, 0.07, 0.003, 0.01, 0.21, 0.004, 0.006, 0.008, 0.002];
const ATT_TF_TAU_S = 0.05;
const ATT_TF_P_MAX = 0.25;
const ATT_TF_POS = 5;
const ATT_TF_W = [5, 4, 3, 2, 1].map(x => x / 15);
const ATT_TF_NONE = [3.6, 0.9, 1.8, 1.6, 0.4];
const ATT_TF_INSTR = "ACCESS_CHECK_FAILED: проверка доступа не завершилась. Проверьте статус auth…";
const ATT_TF_CANDS = [
  { key: "A", query: "ACCESS_CHECK_FAILED", result: ATT_TF_INSTR,
    noRes: [3.4, 0.9, 1.7, 1.5, 0.4], withRes: [0.6, 0.2, 0.3, 0.3, 0.4],
    why: "Запрос по коду ошибки сам продолжение почти не подсказывает, а результат делает его почти предсказуемым. Сильнее всего падает потеря первого слова, у которого и вес наибольший." },
  { key: "B", query: "вход в портал", result: "Вход в портал: используйте корпоративную учётную запись…",
    noRes: [3.3, 0.9, 1.8, 1.6, 0.4], withRes: [3.1, 0.8, 1.7, 1.5, 0.5],
    why: "Инструкция о входе не говорит, что дальше в тексте, и потеря почти не меняется." },
  { key: "C", query: "проверка доступа не завершилась", result: ATT_TF_INSTR,
    noRes: [0.7, 0.2, 0.3, 0.4, 0.3], withRes: [0.5, 0.2, 0.3, 0.3, 0.3],
    why: "Результат верный, и потеря с ним даже ниже, чем у A. Но продолжение уже написано в запросе: модель, составившая такой запрос, знала текст и без инструмента. Поэтому низка и потеря без результата. Без этого варианта в минимуме разность была бы \\(2{,}04-0{,}34=1{,}70\\)." }
];
const ATT_TF_TEXT = ATT_TF_TOKENS.join(" ").replace(" ,", ",").replace(" .", ".");
const ATT_TF_HEAD = "Ошибка ACCESS_CHECK_FAILED означает, что";
const ATT_TF_TAIL = "проверка доступа не завершилась.";

const attTfLoss = values => Math.round(values.reduce((sum, x, t) => sum + ATT_TF_W[t] * x, 0) * 100) / 100;
const attTfNum = (x, d = 2) => fmtN(x, d);
const attTfTex = (x, d = 2) => x.toFixed(d).replace(".", "{,}");
function attTfScore(cand){
  const none = attTfLoss(ATT_TF_NONE), noRes = attTfLoss(cand.noRes), plus = attTfLoss(cand.withRes);
  const minus = Math.min(none, noRes);
  return { none, noRes, plus, minus, diff: Math.round((minus - plus) * 100) / 100 };
}
const attTfPasses = (cand, tau) => attTfScore(cand).diff >= tau - 1e-9;
const attTfCall = (cand, result) => `[search_instruction("${cand.query}") -&gt;${result === undefined ? "" : " " + escapeHtml(result)}]`;

const ATT_TF_STEPS = [
  { title: "1. Где может начаться вызов" },
  { title: "2. Модель предлагает вызовы" },
  { title: "3. Код исполняет кандидатов" },
  { title: "4. Фильтр по потере продолжения" },
  { title: "5. Текст для дообучения" },
  { title: "6. Генерация после дообучения" }
];

function attTfStage(step, cand, tau){
  const prompt = `<div class="att-tf-prompt"><span class="att-tf-muted">Добавь в текст вызовы search_instruction("запрос"), если результат помогает его дописать.
Вход: … Выход: … [search_instruction("…") -&gt; …] …</span>
Вход: ${escapeHtml(ATT_TF_TEXT)}
Выход: ${step === 0 ? `<span class="att-tf-muted">${escapeHtml(ATT_TF_TEXT)}</span>` : `${escapeHtml(ATT_TF_HEAD)} <span class="att-tf-call">[</span>`}</div>`;
  if (step === 0){
    const rows = ATT_TF_TOKENS.map((token, i) => {
      const p = ATT_TF_P[i], pass = p > ATT_TF_TAU_S;
      const cls = ["att-tf-bar"];
      if (pass) cls.push("att-tf-pass");
      if (i === ATT_TF_POS) cls.push("att-tf-sel");
      return `<li class="${cls.join(" ")}"><code>${escapeHtml(token)}</code><span class="att-tf-track"><span class="att-tf-fill" style="width:${(Math.min(p, ATT_TF_P_MAX) / ATT_TF_P_MAX * 100).toFixed(1)}%"></span><span class="att-tf-thr" style="left:${(ATT_TF_TAU_S / ATT_TF_P_MAX * 100).toFixed(1)}%"></span></span><span class="att-tf-val">${attTfNum(p, p < 0.01 ? 3 : 2)}</span></li>`;
    }).join("");
    return `${prompt}<p class="att-tf-cap">Вероятность открыть «[» перед каждым токеном выхода; штрих — порог 0,05</p><ol class="att-tf-bars">${rows}</ol>`;
  }
  if (step === 1 || step === 2){
    const rows = ATT_TF_CANDS.map(c => `<li class="att-tf-cand"><b>${c.key}</b><span><span class="att-tf-call">${step === 1 ? `search_instruction("${escapeHtml(c.query)}")]` : attTfCall(c, c.result)}</span></span></li>`).join("");
    return `${prompt}<p class="att-tf-cap">${step === 1 ? "Сэмплированные продолжения после «[» до закрывающей скобки" : "Каждый вызов исполнен; после стрелки — результат инструмента"}</p><ol class="att-tf-cands">${rows}</ol>`;
  }
  if (step === 3){
    const sc = attTfScore(cand);
    const rowsDef = [
      ["без вызова", "", ATT_TF_NONE, sc.none],
      ["вызов без результата", `<span class="att-tf-call">${attTfCall(cand)}</span> `, cand.noRes, sc.noRes],
      ["вызов с результатом", `<span class="att-tf-call">${attTfCall(cand, cand.result)}</span> `, cand.withRes, sc.plus]
    ];
    const prefixes = rowsDef.map(([label, pre]) => `<li><b>${label}</b><span>${pre}${escapeHtml(ATT_TF_HEAD)} <span class="att-tf-cut">│</span> ${escapeHtml(ATT_TF_TAIL)}</span></li>`).join("");
    const head = ATT_TF_TOKENS.slice(ATT_TF_POS).map(t => `<th>${escapeHtml(t)}</th>`).join("");
    const heat = x => `style="background:color-mix(in srgb, var(--fig-bad) ${Math.round(Math.min(x, 4) / 4 * 42)}%, var(--bg))"`;
    const body = rowsDef.map(([label, , vals, total]) => `<tr><th>${label}</th>${vals.map(v => `<td ${heat(v)}>${attTfNum(v, 1)}</td>`).join("")}<td class="att-tf-sum">${attTfNum(total)}</td></tr>`).join("");
    const pass = attTfPasses(cand, tau);
    return `<ol class="att-tf-prefixes">${prefixes}</ol>
      <div class="att-tf-grid"><table><thead><tr><th>потеря токена</th>${head}<th>взвеш.</th></tr></thead><tbody>
        <tr class="att-tf-w"><th>вес</th>${ATT_TF_W.map(w => `<td>${attTfNum(w)}</td>`).join("")}<td></td></tr>${body}</tbody></table></div>
      <p class="att-tf-verdict">Лучшая без результата: ${attTfNum(sc.minus)} · с результатом: ${attTfNum(sc.plus)} · разность: ${attTfNum(sc.diff)} · порог: ${attTfNum(tau)} <span class="att-tf-chip ${pass ? "att-tf-ok" : "att-tf-no"}">${pass ? "остаётся" : "отбрасывается"}</span></p>`;
  }
  if (step === 4){
    const kept = ATT_TF_CANDS.filter(c => attTfPasses(c, tau));
    const line = kept.length
      ? `${escapeHtml(ATT_TF_HEAD)} <span class="att-tf-call">[search_instruction("${kept[0].query}") -&gt;</span> <span class="att-tf-res">${escapeHtml(kept[0].result)}</span><span class="att-tf-call">]</span> ${escapeHtml(ATT_TF_TAIL)}`
      : escapeHtml(ATT_TF_TEXT);
    const list = ATT_TF_CANDS.map(c => `<li><b>${c.key}</b> разность ${attTfNum(attTfScore(c).diff)} <span class="att-tf-chip ${attTfPasses(c, tau) ? "att-tf-ok" : "att-tf-no"}">${attTfPasses(c, tau) ? "в C*" : "отброшен"}</span></li>`).join("");
    return `<p class="att-tf-cap">${kept.length ? "Фраза в корпусе C*" : "Фраза исключена из обучающего корпуса"} при пороге ${attTfNum(tau)}</p><div class="att-tf-prompt">${line}</div>
      <ul class="att-tf-kept">${list}<li><b>«означает»</b> вторая позиция: пусть её кандидаты фильтр не прошли</li></ul>
      <p class="att-tf-cap">${kept.length ? "Дообучение — обычная задача языкового моделирования на сохранённых текстах C*, включая вставленные вызовы." : "В эксперименте Toolformer тексты без прошедших фильтр вызовов исключали из обучения."}</p>`;
  }
  const a = ATT_TF_CANDS[0];
  return `<p class="att-tf-cap">Генерация после дообучения: кто пишет каждый фрагмент</p>
    <ol class="att-tf-gen">
      <li><b>модель</b><span>${escapeHtml(ATT_TF_HEAD)} <span class="att-tf-call">[search_instruction("${a.query}") -&gt;</span></span></li>
      <li class="att-tf-pause"><b>пауза</b><span>модель написала «-&gt;»: декодирование остановлено, код исполняет вызов</span></li>
      <li><b>код</b><span><span class="att-tf-res">${escapeHtml(a.result)}</span><span class="att-tf-call">]</span></span></li>
      <li><b>модель</b><span>${escapeHtml(ATT_TF_TAIL)}</span></li>
    </ol>`;
}

function attTfSay(step, cand, tau){
  if (step === 0) return "Модель переписывает текст после промпта с примерами. Перед каждым токеном \\(x_i\\) берётся вероятность открыть скобку \\(p_i=p_M(\\text{«[»}\\mid P(x),\\,x_{1:i-1})\\); все \\(p_i\\) даёт один прямой проход. Порог \\(\\tau_s=0{,}05\\) прошли две позиции: перед «означает» и перед «проверка». Дальше разбираем вторую.";
  if (step === 1) return "В выбранной позиции модель продолжает префикс с открытой скобкой до закрывающей и сэмплирует несколько кандидатов, в статье до пяти. A ищет по коду ошибки, B — по общей теме, C — по словам, которые идут в тексте дальше.";
  if (step === 2) return "Код исполняет каждый кандидат настоящим инструментом. A и C вернули инструкцию access-17, B — инструкцию о входе в портал. Полезен ли вызов, пока неизвестно: это решает фильтр.";
  if (step === 3){
    const sc = attTfScore(cand), pass = attTfPasses(cand, tau);
    return `<b>Кандидат ${cand.key}.</b> Лучшая потеря без результата \\(L_i^{-}=\\min(${attTfTex(sc.none)};\\ ${attTfTex(sc.noRes)})=${attTfTex(sc.minus)}\\), с результатом \\(L_i^{+}=${attTfTex(sc.plus)}\\), разность \\(${attTfTex(sc.diff)}\\) ${pass ? "не меньше" : "меньше"} порога \\(\\tau_f=${attTfTex(tau)}\\): вызов ${pass ? "остаётся" : "отбрасывается"}. ${cand.why}`;
  }
  if (step === 4){
    return ATT_TF_CANDS.some(c => attTfPasses(c, tau))
      ? "Прошедший вызов вставлен в позицию перед «проверка» вместе с результатом. Исходная фраза сохранена; модель учится и обычному тексту, и вставленному вызову."
      : `При \\(\\tau_f=${attTfTex(tau)}\\) не прошёл ни один кандидат: в экспериментальном рецепте Toolformer такая фраза исключается из обучающей выборки. Более строгий порог требует большего снижения потери, но не гарантирует правильность результата.`;
  }
  return "Генерация обычная, пока модель не напишет «-&gt;». Тогда декодирование приостанавливается, код исполняет вызов и вставляет результат со скобкой, а модель продолжает уже с результатом в контексте. Это разрыв между предложением вызова и исполнением из агентного цикла, только внутри одного текста.";
}

function mountAttToolformer(box){
  let step = 0;
  let cand = ATT_TF_CANDS[0];
  let tau = 1;
  box.innerHTML = `
    <div class="fig-stage att-tf-stage">
      <div class="att-heading"><b data-title></b><span>условные числа</span></div>
      <div class="att-tf-body" data-body></div>
    </div>
    <div class="fig-row">
      <button type="button" class="fig-btn icon" data-prev aria-label="Предыдущий шаг">${ICON.prev}</button>
      <button type="button" class="fig-btn" data-next>Далее ${ICON.next}</button>
      <button type="button" class="fig-btn" data-reset>В начало</button>
      <span class="fig-status" data-position></span>
    </div>
    <div class="fig-row att-tf-controls">
      <span class="fig-seg">Кандидат <span class="fig-tabs" role="group" aria-label="Кандидат">${ATT_TF_CANDS.map(c => `<button type="button" data-cand="${c.key}">${c.key}</button>`).join("")}</span></span>
      <label class="fig-range">порог \\(\\tau_f\\) <input type="range" min="0.25" max="2" step="0.05" value="1" data-tau><output data-tau-out>1,00</output></label>
    </div>
    <p class="fig-say" aria-live="polite"></p>
    <div class="fig-legend">${legend([
      ['<i class="att-key att-tf-key-call"></i>', "вызов, предложенный моделью"],
      ['<i class="att-key att-tf-key-res"></i>', "результат инструмента"],
      ['<i class="att-key att-tf-key-pass"></i>', "позиция прошла порог"]
    ])}</div>`;

  const get = selector => box.querySelector(selector);
  const prev = get("[data-prev]");
  const next = get("[data-next]");
  const reset = get("[data-reset]");
  const slider = get("[data-tau]");
  const candButtons = [...box.querySelectorAll("[data-cand]")];

  const render = () => {
    get("[data-title]").textContent = ATT_TF_STEPS[step].title;
    get("[data-body]").innerHTML = attTfStage(step, cand, tau);
    get(".fig-say").innerHTML = attTfSay(step, cand, tau);
    get("[data-position]").textContent = `Шаг ${step + 1} из ${ATT_TF_STEPS.length}`;
    get("[data-tau-out]").textContent = attTfNum(tau);
    for (const b of candButtons){
      b.setAttribute("aria-selected", String(b.dataset.cand === cand.key));
      b.disabled = step !== 3;
    }
    slider.disabled = step < 3 || step > 4;
    get(".att-tf-controls").classList.toggle("att-tf-off", step < 3 || step > 4);
    prev.disabled = step === 0;
    next.disabled = step === ATT_TF_STEPS.length - 1;
    reset.disabled = step === 0;
  };
  const onPrev = () => { step--; render(); };
  const onNext = () => { step++; render(); };
  const onReset = () => { step = 0; render(); };
  const onCand = event => { cand = ATT_TF_CANDS.find(c => c.key === event.currentTarget.dataset.cand); render(); };
  const onTau = () => { tau = Number(slider.value); render(); };
  prev.addEventListener("click", onPrev);
  next.addEventListener("click", onNext);
  reset.addEventListener("click", onReset);
  for (const b of candButtons) b.addEventListener("click", onCand);
  slider.addEventListener("input", onTau);
  render();
  return () => {
    prev.removeEventListener("click", onPrev);
    next.removeEventListener("click", onNext);
    reset.removeEventListener("click", onReset);
    for (const b of candButtons) b.removeEventListener("click", onCand);
    slider.removeEventListener("input", onTau);
  };
}

Object.assign(FIGURES, {
  "att-stream": mountAttStream,
  "att-toolformer": mountAttToolformer
});

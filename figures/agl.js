/* agents/agent-loop: заданные траектории, без вызовов модели и сети. */

function aglTrace(mode, maxDecisions){
  const question = "При входе в портал получаю ACCESS_CHECK_FAILED. Что делать?";
  const instruction = "access-17: проверка доступа не завершилась; проверьте auth. Если инцидента нет, нужны подробный текст и время ошибки.";
  const status = {
    incident: "auth: зарегистрирован инцидент — проверки доступа завершаются по тайм-ауту.",
    normal: "auth: на странице статуса нет зарегистрированного инцидента.",
    error: "Чтение статуса: TimeoutError. Наблюдение о сервисе не получено."
  }[mode];
  const snapshots = [];
  const state = {
    history: [{ kind: "user", text: question }],
    decisions: 0,
    actor: "runtime",
    phase: "Начальный контекст",
    request: "Ещё не выбран",
    execution: "Инструменты не вызывались",
    outcome: "Запуск продолжается",
    text: "Код передаёт вопрос, инструкцию для модели и описания двух инструментов. Наблюдений о среде пока нет."
  };
  const save = () => snapshots.push({ ...state, history: state.history.map(item => ({ ...item })) });
  function call(name, args, id){
    state.decisions++;
    state.actor = "model";
    state.phase = "Модель предложила вызов";
    state.request = `${name}(${args})`;
    state.execution = "Не выполнен";
    state.history.push({ kind: "call", text: `${id}: ${state.request}` });
    state.text = "Код получил и проверил запрос на действие, затем записал его в журнал. Результата ещё нет; запись вызова не означает исполнение.";
    save();
    state.actor = "tool";
    state.phase = "Код вызвал инструмент";
    state.execution = "Выполняется; результат ещё не записан";
    state.text = "Исполнитель нашёл функцию в реестре и передал ей аргументы. Модель в этот момент не принимает нового решения.";
    save();
  }
  function observe(text, id){
    state.actor = "runtime";
    state.phase = "Наблюдение добавлено в контекст";
    state.execution = mode === "error" && id === "call-2" ? "Получена ошибка чтения" : "Инструмент вернул данные";
    state.history.push({ kind: "observation", text: `${id}: ${text}` });
    state.text = id === "call-1"
      ? "Теперь в журнале есть инструкция. Код включит её в следующий контекст; модель сможет выбрать проверку auth."
      : "Код сохранил фактический результат и готовит новый контекст. Инцидент, нормальный статус и ошибка чтения дают разные основания для следующего решения.";
    save();
  }
  function limit(){
    state.actor = "runtime";
    state.phase = "Предел решений";
    state.outcome = "step_limit";
    state.text = "Предел исчерпан. Код прекращает запуск без дополнительного вызова модели. Наблюдения сохранены, но финальный ответ модель не сформировала.";
    save();
    return snapshots;
  }
  save();
  call("search_instruction", 'query="ACCESS_CHECK_FAILED"', "call-1");
  observe(instruction, "call-1");
  if (maxDecisions === 1) return limit();
  call("get_service_status", 'service="auth"', "call-2");
  observe(status, "call-2");
  if (maxDecisions === 2) return limit();
  state.decisions++;
  state.actor = "model";
  state.phase = "Модель выбрала завершение";
  state.outcome = mode === "incident" ? "completed" : "blocked";
  state.request = `Finish(${state.outcome})`;
  state.execution = "Завершение не вызывает инструмент";
  state.text = mode === "incident"
    ? "Инцидент auth может объяснять ошибку. Дождитесь восстановления и повторите вход; если ошибка сохранится, пришлите подробный текст и время. Задача ответа завершена, восстановление доступа не подтверждено."
    : mode === "normal"
      ? "На странице статуса инцидента нет. Причина не установлена; нужны подробный текст и время ошибки. Доступных инструментов для дальнейшей диагностики нет."
      : "Прочитать статус не удалось. Это не доказывает сбой auth; нужны подробный текст и время ошибки, а также сведения о статусе сервиса.";
  save();
  return snapshots;
}

function mountAglCycle(box){
  let mode = "incident";
  let maxDecisions = 3;
  let step = 0;
  box.innerHTML = `
    <div class="fig-stage agl-stage">
      <div class="agl-heading"><b data-phase></b><span data-budget></span></div>
      <div class="agl-grid">
        <section class="agl-panel">
          <h3>Состояние запуска и доступные данные</h3>
          <p class="agl-fixed">Правило: опирайся на результаты; если продолжить нельзя, назови недостающие данные.</p>
          <p class="agl-fixed">Инструменты: <code>search_instruction(query)</code>, <code>get_service_status(service)</code>.</p>
          <ol class="agl-history" data-history></ol>
        </section>
        <section class="agl-panel">
          <h3>Выбор и исполнение</h3>
          <div class="agl-actors"><span data-actor="model">Модель</span><span data-actor="runtime">Код</span><span data-actor="tool">Инструмент</span></div>
          <dl class="agl-decision">
            <dt>Последнее решение</dt><dd data-request></dd>
            <dt>Исполнение</dt><dd data-execution></dd>
            <dt>Исход</dt><dd data-outcome></dd>
          </dl>
          <p class="agl-fixed">Внешняя среда: база инструкций и сервис auth. Эти операции читают данные и не меняют права.</p>
        </section>
      </div>
    </div>
    <div class="fig-row">
      <button type="button" class="fig-btn icon" data-prev aria-label="Предыдущий шаг">${ICON.prev}</button>
      <button type="button" class="fig-btn" data-next>Далее ${ICON.next}</button>
      <button type="button" class="fig-btn" data-reset>В начало</button>
      <span class="fig-status" data-position></span>
    </div>
    <div class="fig-row">
      <label class="agl-select">Результат статуса
        <select data-mode><option value="incident">Инцидент</option><option value="normal">Нормальный статус</option><option value="error">Ошибка чтения</option></select>
      </label>
      <label class="agl-select">Предел решений модели
        <select data-limit><option value="3">3</option><option value="2">2</option><option value="1">1</option></select>
      </label>
    </div>
    <p class="fig-say" aria-live="polite"></p>
    <div class="fig-legend">${legend([
      ['<i class="agl-key agl-model"></i>', "решение модели"],
      ['<i class="agl-key agl-runtime"></i>', "действие исполняющего кода"],
      ['<i class="agl-key agl-tool"></i>', "исполнение инструментом / наблюдение"]
    ])}</div>`;

  const get = selector => box.querySelector(selector);
  const prev = get("[data-prev]");
  const next = get("[data-next]");
  const render = () => {
    const trace = aglTrace(mode, maxDecisions);
    step = Math.min(step, trace.length - 1);
    const current = trace[step];
    get("[data-phase]").textContent = current.phase;
    get("[data-budget]").textContent = `Решений: ${current.decisions} из ${maxDecisions}`;
    get("[data-history]").innerHTML = current.history.map(item => {
      const labels = { user: "Вопрос", call: "Запрос инструмента", observation: "Наблюдение" };
      return `<li class="agl-entry agl-${item.kind}"><b>${labels[item.kind]}</b><span>${escapeHtml(item.text)}</span></li>`;
    }).join("");
    get("[data-request]").textContent = current.request;
    get("[data-execution]").textContent = current.execution;
    get("[data-outcome]").textContent = current.outcome;
    for (const actor of box.querySelectorAll("[data-actor]")){
      actor.classList.toggle("agl-active", actor.dataset.actor === current.actor);
    }
    get("[data-position]").textContent = `Шаг ${step + 1} из ${trace.length}`;
    get(".fig-say").textContent = current.text;
    prev.disabled = step === 0;
    next.disabled = step === trace.length - 1;
  };
  const previous = () => { step--; render(); };
  const advance = () => { step++; render(); };
  const reset = () => { step = 0; render(); };
  const changeMode = event => { mode = event.target.value; reset(); };
  const changeLimit = event => { maxDecisions = Number(event.target.value); reset(); };
  prev.addEventListener("click", previous);
  next.addEventListener("click", advance);
  get("[data-reset]").addEventListener("click", reset);
  get("[data-mode]").addEventListener("change", changeMode);
  get("[data-limit]").addEventListener("change", changeLimit);
  render();
  return () => {
    prev.removeEventListener("click", previous);
    next.removeEventListener("click", advance);
    get("[data-reset]").removeEventListener("click", reset);
    get("[data-mode]").removeEventListener("change", changeMode);
    get("[data-limit]").removeEventListener("change", changeLimit);
  };
}

Object.assign(FIGURES, {
  "agl-cycle": mountAglCycle
});

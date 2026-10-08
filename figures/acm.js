/* agents/context-memory: условные размеры, отбор данных без LLM. */
const ACM_HISTORY = [
  { id: "e1", title: "Просьба пользователя", tokens: 256,
    text: "«Маленький принц», русский язык, бумага; до \\(1500\\) руб. с доставкой; получить до 2026-10-09. Заказ только после подтверждения." },
  { id: "e2", title: "Вызов и результат: A / «Лист»", tokens: 1024,
    text: "Русский, бумага. Книга \\(950\\), доставка \\(350\\), всего \\(1300\\) руб. Получение 2026-10-09. Прочитано 2026-10-08 10:00." },
  { id: "e3", title: "Вызов и результат: B / «Полка»", tokens: 1024,
    text: "Русский, бумага. Книга \\(900\\), доставка \\(650\\), всего \\(1550\\) руб. Получение 2026-10-09." },
  { id: "e4", title: "Вызов и результат: C / «Том»", tokens: 1024,
    text: "Английский, бумага. Книга \\(800\\), доставка \\(200\\), всего \\(1000\\) руб. Получение 2026-10-08." },
  { id: "e5", title: "Последний вопрос", tokens: 128, text: "Какой вариант подходит?" }
];

const ACM_SUMMARY = {
  id: "summary", title: "Неудачная сводка e1–e3", tokens: 320,
  text: "Нужен бумажный «Маленький принц» на русском до \\(1500\\) руб. к 2026-10-09. A стоит \\(950\\), B — \\(900\\). Заказ после подтверждения. Доставка и включение её в бюджет потеряны."
};
const ACM_STATE = {
  id: "state", title: "Состояние по e1–e3", tokens: 640,
  text: "Условия [e1]: нужная книга, русский, бумага; всего до \\(1500\\) руб., включая доставку; получить до 2026-10-09. A [e2]: все свойства проверены, всего \\(1300\\) руб., дата 2026-10-09; наблюдение от 2026-10-08 10:00. B [e3]: всего \\(1550\\) руб., исключён по бюджету. Подтверждения заказа нет."
};

function acmBuildView(mode, windowSize){
  const fixed = 512;
  const reserve = 512;
  const capacity = windowSize - fixed - reserve;
  let blocks;
  if (mode === "full") blocks = ACM_HISTORY.slice();
  else if (mode === "tail") {
    blocks = [];
    let used = 0;
    for (let i = ACM_HISTORY.length - 1; i >= 0; i--){
      const block = ACM_HISTORY[i];
      if (used + block.tokens > capacity) break;
      blocks.unshift(block);
      used += block.tokens;
    }
  } else if (mode === "summary") blocks = [ACM_SUMMARY, ...ACM_HISTORY.slice(3)];
  else if (mode === "state") blocks = [ACM_STATE, ...ACM_HISTORY.slice(3)];
  else throw new Error("Неизвестный режим сборки");

  const used = blocks.reduce((total, block) => total + block.tokens, 0);
  const fits = used <= capacity;
  const ids = new Set(blocks.map(block => block.id));
  const hasConditions = ids.has("e1") || ids.has("state");
  const hasCandidate = ids.has("e2") || ids.has("state");
  let verdict, explanation;
  if (!fits){
    verdict = "Вход не помещается";
    explanation = `Проект входа превышает окно на \\(${used - capacity}\\) токенов. Его нельзя отправить в заданном бюджете. Увеличьте окно или смените способ сборки; обязательные условия нельзя удалять незаметно.`;
  } else if (hasConditions && hasCandidate){
    verdict = "Данных достаточно, чтобы предложить A";
    explanation = "По сохранённым наблюдениям A укладывается в полную стоимость и срок; B превышает бюджет, C не подходит по языку. Можно предложить A пользователю. Это проверка доступности данных, а не гарантия ответа модели и не подтверждение заказа.";
  } else if (mode === "summary"){
    verdict = "Нельзя проверить полную стоимость";
    explanation = "Сводка поместилась, но потеряла доставку и условие включить её в бюджет. B выглядит дешевле A только по цене книги. Дополнительное место не восстановит потерянное условие: нужно исправить сводку по исходным записям.";
  } else {
    verdict = "Не хватает условий задачи";
    explanation = hasCandidate
      ? "Предложения доступны, но исходная просьба осталась вне входа. Без неё нельзя проверить язык, предел полной стоимости и необходимость подтверждения."
      : "В хвосте нет исходной просьбы и предложения A. Сохранённый на диске журнал не помогает текущему решению, пока нужные записи не включены в контекст.";
  }
  return { blocks, fixed, reserve, capacity, used, fits, verdict, explanation,
    compressed: mode === "summary" || mode === "state" ? ["e1", "e2", "e3"] : [] };
}

function mountAcmContext(box){
  let mode = "full";
  let windowSize = 4096;
  let initialized = false;
  box.innerHTML = `
    <div class="fig-stage acm-stage">
      <div class="acm-budget"><b data-budget></b><span data-fixed></span></div>
      <div class="acm-meter" aria-hidden="true"><div data-fill></div></div>
      <div class="acm-columns">
        <section class="acm-panel"><h3>Полный журнал в хранилище</h3><div data-history></div></section>
        <section class="acm-panel"><h3>Проект входа следующего вызова</h3><div data-context></div></section>
      </div>
      <p class="acm-verdict" data-verdict></p>
    </div>
    <div class="fig-row acm-modes" role="group" aria-label="Способ сборки контекста">
      <button type="button" class="fig-btn" data-mode="full">Вся история</button>
      <button type="button" class="fig-btn" data-mode="tail">Последние записи</button>
      <button type="button" class="fig-btn" data-mode="summary">Сводка и последние</button>
      <button type="button" class="fig-btn" data-mode="state">Состояние и последние</button>
    </div>
    <div class="fig-row">
      <label class="fig-range acm-range">Окно в токенах <input type="range" min="2048" max="5120" step="256" value="4096"><output>4096</output></label>
      <button type="button" class="fig-btn" data-reset>Сброс</button>
    </div>
    <p class="fig-say" aria-live="polite"></p>
    <div class="fig-legend">${legend([
      ['<i class="acm-key acm-raw"></i>', "исходная запись во входе"],
      ['<i class="acm-key acm-compressed"></i>', "заменена сводкой или состоянием"],
      ['<i class="acm-key acm-omitted"></i>', "только в хранилище"]
    ])}</div>`;

  const get = selector => box.querySelector(selector);
  const stage = get(".acm-stage");
  const slider = get('input[type="range"]');
  const modeButtons = [...box.querySelectorAll("[data-mode]")];
  function card(block, label, cls){
    return `<div class="acm-card ${cls}"><div class="acm-card-head"><b>${escapeHtml(block.title)}</b><small>${block.tokens} токенов</small></div><p>${escapeHtml(block.text)}</p>${label ? `<span class="acm-label">${label}</span>` : ""}</div>`;
  }
  function render(){
    const view = acmBuildView(mode, windowSize);
    if (initialized && typeof clearMath === "function") clearMath(stage);
    const included = new Set(view.blocks.map(block => block.id));
    get("[data-history]").innerHTML = ACM_HISTORY.map(block => {
      const label = included.has(block.id) ? "Во входе" : view.compressed.includes(block.id) ? "В сжатом прошлом" : "Вне входа";
      const cls = included.has(block.id) ? "acm-raw" : view.compressed.includes(block.id) ? "acm-compressed" : "acm-omitted";
      return card(block, label, cls);
    }).join("");
    get("[data-context]").innerHTML = view.blocks.map(block => card(block, "", block.id === "state" || block.id === "summary" ? "acm-compressed" : "acm-raw")).join("");
    get("[data-budget]").textContent = `Данные: ${view.used} / ${view.capacity} токенов`;
    get("[data-fixed]").textContent = `Ещё ${view.fixed} на инструкции и инструменты; ${view.reserve} — резерв генерации`;
    get("[data-fill]").style.width = `${Math.min(100, view.used / view.capacity * 100)}%`;
    stage.classList.toggle("acm-overflow", !view.fits);
    get("[data-verdict]").textContent = view.verdict;
    get(".fig-say").textContent = view.explanation;
    for (const button of modeButtons) button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
    if (initialized && typeof typesetMath === "function") typesetMath([stage]);
    initialized = true;
  }
  const changeMode = event => { mode = event.currentTarget.dataset.mode; render(); };
  const changeWindow = () => {
    windowSize = Number(slider.value);
    get("output").textContent = String(windowSize);
    render();
  };
  const reset = () => {
    mode = "full";
    slider.value = "4096";
    changeWindow();
  };
  for (const button of modeButtons) button.addEventListener("click", changeMode);
  slider.addEventListener("input", changeWindow);
  get("[data-reset]").addEventListener("click", reset);
  render();
  return () => {
    for (const button of modeButtons) button.removeEventListener("click", changeMode);
    slider.removeEventListener("input", changeWindow);
    get("[data-reset]").removeEventListener("click", reset);
    if (typeof clearMath === "function") clearMath(stage);
  };
}

Object.assign(FIGURES, {
  "acm-context": mountAcmContext
});

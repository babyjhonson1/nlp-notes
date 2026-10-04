/* Иллюстрация раздела rag/chunking: сравнение стратегий разбиения. */

function mountChunkStrategies(box){
  const sentences = [
    { heading: "Доступ", text: "Пользователь запрашивает сброс пароля в форме входа." },
    { heading: "Доступ", text: "Ссылка действует пятнадцать минут и только один раз." },
    { heading: "Доступ", text: "После трёх ошибок учётная запись временно блокируется." },
    { heading: "Поиск", text: "Модель эмбеддингов кодирует запрос и фрагменты документов." },
    { heading: "Поиск", text: "После смены модели векторный индекс строят заново." }
  ];
  const distances = [0.16, 0.31, 0.82, 0.22];
  const colors = ["var(--g1)", "var(--g2)", "var(--g3)", "var(--g4)"];
  let mode = "fixed";
  let size = 14;
  let overlap = 3;
  let threshold = 0.55;

  box.innerHTML = `
    <div class="fig-stage chunk-stage"></div>
    <div class="fig-row">
      <div class="fig-tabs" role="tablist" aria-label="Стратегия чанкинга">
        <button type="button" role="tab" data-mode="fixed">Окно</button>
        <button type="button" role="tab" data-mode="structure">Структура</button>
        <button type="button" role="tab" data-mode="semantic">Семантика</button>
      </div>
      <span class="spacer"></span>
      <div class="chunk-range-set" data-controls="fixed">
        <label class="fig-range">размер <input type="range" min="10" max="20" step="2" value="14" data-range="size"><output>14</output></label>
        <label class="fig-range">overlap <input type="range" min="0" max="6" step="1" value="3" data-range="overlap"><output>3</output></label>
      </div>
      <div class="chunk-range-set" data-controls="semantic" hidden>
        <label class="fig-range">порог <input type="range" min="20" max="85" step="5" value="55" data-range="threshold"><output>0,55</output></label>
      </div>
    </div>
    <p class="fig-say"></p>
    <div class="fig-legend">
      <span><i class="chunk-key overlap"></i>повтор из предыдущего окна</span>
      <span><i class="chunk-key boundary"></i>семантический разрыв</span>
    </div>`;

  const stage = box.querySelector(".chunk-stage");
  const say = box.querySelector(".fig-say");
  const esc = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const allText = sentences.map((s) => s.text).join(" ");
  const words = allText.split(/\s+/);

  function card(label, text, color, overlapCount = 0){
    const tokens = text.split(/\s+/);
    const html = tokens.map((token, i) => overlapCount && i < overlapCount
      ? `<span class="chunk-overlap">${esc(token)}</span>`
      : esc(token)).join(" ");
    return `<div class="chunk-card" style="--gc:${color}"><div class="chunk-card-label">${esc(label)}</div><div class="chunk-card-text">${html}</div></div>`;
  }

  function fixedView(){
    const stride = size - overlap;
    const chunks = [];
    for (let start = 0; start < words.length; start += stride){
      const part = words.slice(start, start + size);
      if (!part.length) break;
      chunks.push(card(`чанк ${chunks.length + 1}`, part.join(" "), colors[chunks.length % colors.length], start ? Math.min(overlap, part.length) : 0));
      if (start + size >= words.length) break;
    }
    stage.innerHTML = `<div class="chunk-doc-title"><span>Фиксированное окно по токенам</span><span>${chunks.length} фрагмента</span></div><div class="chunk-list">${chunks.join("")}</div>`;
    const multiplier = size / stride;
    say.innerHTML = `Шаг равен \\(c-o=${size}-${overlap}=${stride}\\). При длинном тексте объём индексируемых токенов вырастает примерно в \\(${multiplier.toFixed(2).replace(".", ",")}\\) раза. Окно не знает, что четвёртое предложение начинает новую тему.`;
  }

  function structureView(){
    const groups = [];
    for (const sentence of sentences){
      let group = groups[groups.length - 1];
      if (!group || group.heading !== sentence.heading){ group = { heading: sentence.heading, texts: [] }; groups.push(group); }
      group.texts.push(sentence.text);
    }
    stage.innerHTML = `<div class="chunk-doc-title"><span>Границы по заголовкам</span><span>${groups.length} фрагмента</span></div><div class="chunk-list">${groups.map((group, i) => card(group.heading, group.texts.join(" "), colors[i])).join("")}</div>`;
    say.innerHTML = "Структурный splitter сохраняет два раздела целиком: предложения про доступ не смешиваются с поиском. Если раздел окажется слишком длинным, его можно рекурсивно делить по абзацам и предложениям.";
  }

  function semanticView(){
    let group = 0;
    const parts = [];
    sentences.forEach((sentence, i) => {
      parts.push(card(`фрагмент ${group + 1}`, sentence.text, colors[group % colors.length]));
      if (i < distances.length){
        const d = distances[i];
        const cut = d > threshold;
        parts.push(`<div class="chunk-boundary ${cut ? "break" : ""}"><span>${cut ? "разрыв" : "вместе"}</span><span class="chunk-boundary-line" style="--score:${Math.round(d * 100)}%"><i></i></span><b>${d.toFixed(2).replace(".", ",")}</b></div>`);
        if (cut) group++;
      }
    });
    stage.innerHTML = `<div class="chunk-doc-title"><span>Расстояние между соседними предложениями</span><span>${group + 1} фрагмента</span></div><div class="chunk-list">${parts.join("")}</div>`;
    say.innerHTML = `Граница появляется при \\(d_i>${threshold.toFixed(2).replace(".", ",")}\\). Сильный пик отделяет тему поиска от темы доступа; меньшие локальные различия можно включить или исключить порогом.`;
  }

  function draw(){
    box.querySelectorAll("[data-mode]").forEach((button) => button.setAttribute("aria-selected", String(button.dataset.mode === mode)));
    box.querySelectorAll("[data-controls]").forEach((controls) => { controls.hidden = controls.dataset.controls !== mode; });
    if (mode === "fixed") fixedView();
    else if (mode === "structure") structureView();
    else semanticView();
  }

  box.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => { mode = button.dataset.mode; draw(); }));
  box.querySelector('[data-range="size"]').addEventListener("input", (event) => {
    size = Number(event.target.value);
    if (overlap >= size) overlap = size - 1;
    event.target.nextElementSibling.value = size;
    draw();
  });
  box.querySelector('[data-range="overlap"]').addEventListener("input", (event) => {
    overlap = Math.min(Number(event.target.value), size - 1);
    event.target.nextElementSibling.value = overlap;
    draw();
  });
  box.querySelector('[data-range="threshold"]').addEventListener("input", (event) => {
    threshold = Number(event.target.value) / 100;
    event.target.nextElementSibling.value = threshold.toFixed(2).replace(".", ",");
    draw();
  });
  draw();
}

Object.assign(FIGURES, {
  "chunk-strategies": mountChunkStrategies
});

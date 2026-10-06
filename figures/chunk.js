/* Иллюстрация раздела rag/chunking: сравнение стратегий разбиения на сквозном документе раздела. */

function mountChunkStrategies(box){
  // Документ «Доступ к учётной записи» из текста раздела; номера предложений совпадают с таблицей в разделе.
  const ROOT = "Доступ";
  const DOC = [
    { sec: "Сброс пароля", text: "Чтобы сбросить пароль, нажмите «Забыли пароль?» на странице входа." },
    { sec: "Сброс пароля", text: "Ссылка для сброса придёт на привязанную почту и действует 15 минут." },
    { sec: "Сброс пароля", text: "Если доступа к почте нет, этот способ не подойдёт." },
    { sec: "Восстановление без почты", text: "Подтвердите личность через форму поддержки по номеру телефона из профиля." },
    { sec: "Восстановление без почты", text: "Для корпоративных аккаунтов запрос дополнительно подтверждает администратор." },
    { sec: "Блокировка входа", text: "После пяти неудачных попыток вход блокируется на 30 минут." }
  ];
  const LINK = 1, COND = 2, EVID = 3, CORP = 4;       // индексы предложений (2), (3), (4), (5)
  const distances = [0.18, 0.27, 0.34, 0.31, 0.79];   // условные расстояния между соседними предложениями
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
        <label class="fig-range">окно \\(c\\) <input type="range" min="10" max="24" step="2" value="14" data-range="size"><output>14</output></label>
        <label class="fig-range">overlap \\(o\\) <input type="range" min="0" max="6" step="1" value="3" data-range="overlap"><output>3</output></label>
      </div>
      <div class="chunk-range-set" data-controls="semantic" hidden>
        <label class="fig-range">порог \\(\\tau\\) <input type="range" min="20" max="85" step="5" value="55" data-range="threshold"><output>0,55</output></label>
      </div>
    </div>
    <p class="fig-say"></p>
    <div class="fig-legend">
      <span><i class="chunk-key evid"></i>ответ на вопрос «забыл пароль, почта не открывается»</span>
      <span><i class="chunk-key overlap"></i>повтор из предыдущего окна</span>
      <span><i class="chunk-key boundary"></i>семантический разрыв</span>
    </div>`;

  const stage = box.querySelector(".chunk-stage");
  const say = box.querySelector(".fig-say");
  const esc = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const num = (x, d = 2) => x.toFixed(d).replace(".", ",");
  // Слова документа (условные токены) с номером предложения.
  const words = [];
  const span = DOC.map((sentence, s) => {
    const start = words.length;
    sentence.text.split(/\s+/).forEach((w) => words.push({ w, s }));
    return [start, words.length];
  });
  const L = words.length;
  const plural = (n, one, few, many) => (n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many);
  const fragments = (n) => `${n} ${plural(n, "фрагмент", "фрагмента", "фрагментов")}`;

  function card(label, list, color, overlapCount = 0, path = ""){
    const html = list.map((x, i) => {
      const cls = [overlapCount && i < overlapCount ? "chunk-overlap" : "", x.s === EVID ? "chunk-evid" : ""].filter(Boolean).join(" ");
      return cls ? `<span class="${cls}">${esc(x.w)}</span>` : esc(x.w);
    }).join(" ");
    return `<div class="chunk-card" style="--gc:${color}"><div class="chunk-card-label">${esc(label)}</div><div class="chunk-card-text">${path ? `<div class="chunk-path">${esc(path)}</div>` : ""}${html}</div></div>`;
  }
  const contains = ([a, b], s) => a <= span[s][0] && span[s][1] <= b;

  function fixedView(){
    const stride = size - overlap;
    const windows = [];
    for (let start = 0; start < L; start += stride){
      windows.push([start, Math.min(start + size, L)]);
      if (start + size >= L) break;
    }
    const n = windows.length;
    const total = windows.reduce((sum, [a, b]) => sum + b - a, 0);   // = L + (n - 1) o
    stage.innerHTML = `<div class="chunk-doc-title"><span>Фиксированное окно по словам (условные токены)</span><span>${fragments(n)}</span></div><div class="chunk-list">${windows.map((w, i) => card(`чанк ${i + 1}`, words.slice(w[0], w[1]), colors[i % colors.length], i ? overlap : 0)).join("")}</div>`;
    const cut = DOC.map((_, s) => s).filter((s) => !windows.some((w) => contains(w, s)));
    const evidWins = windows.filter((w) => contains(w, EVID));
    let text = `Шаг \\(s=c-o=${stride}\\), окон \\(n=${n}\\), индексируется \\(L+(n-1)o=${L}+${n - 1}\\cdot${overlap}=${total}\\) слов вместо \\(${L}\\). `;
    if (!evidWins.length) text += "Инструкция для вопроса о недоступной почте (подчёркнута) разрезана между чанками.";
    else if (evidWins.some((w) => contains(w, COND))) text += "Инструкция (подчёркнута) попала в один чанк с условием «доступа к почте нет» — по нему чанк и найдётся.";
    else text += "Инструкция (подчёркнута) цела, но в её чанке нет ни слова о почте: окно не видит заголовок «Восстановление без почты».";
    text += cut.length
      ? ` Разрезано предложений: ${cut.length}${cut.includes(LINK) ? ", в том числе «ссылка … действует 15 минут»: предмет и срок оказались в разных чанках" : ""}.`
      : " Ни одно предложение не разрезано.";
    say.innerHTML = text;
  }

  function structureView(){
    const groups = [];
    DOC.forEach((sentence, s) => {
      let group = groups[groups.length - 1];
      if (!group || group.sec !== sentence.sec){ group = { sec: sentence.sec, list: [] }; groups.push(group); }
      group.list.push(...words.slice(span[s][0], span[s][1]));
    });
    stage.innerHTML = `<div class="chunk-doc-title"><span>Границы по заголовкам, путь заголовков в тексте для поиска</span><span>${fragments(groups.length)}</span></div><div class="chunk-list">${groups.map((g, i) => card(`чанк ${i + 1}`, g.list, colors[i % colors.length], 0, `${ROOT} → ${g.sec}`)).join("")}</div>`;
    say.innerHTML = "Ни одно предложение не разрезано, и условие «доступа к почте нет» осталось рядом со способом, который оно ограничивает. Сама инструкция для вопроса о недоступной почте почту не упоминает, но путь заголовков «Доступ → Восстановление без почты» добавляет это слово в текст для поиска. Слишком длинный раздел пришлось бы делить дальше — рекурсивно, по абзацам и предложениям.";
  }

  function semanticView(){
    let group = 0;
    const groupOf = [0];
    const parts = [];
    DOC.forEach((sentence, s) => {
      parts.push(card(`фрагмент ${group + 1}`, words.slice(span[s][0], span[s][1]), colors[group % colors.length]));
      if (s < distances.length){
        const d = distances[s];
        const cut = d > threshold;
        parts.push(`<div class="chunk-boundary ${cut ? "break" : ""}"><span>${cut ? "разрыв" : "вместе"}</span><span class="chunk-boundary-line" style="--score:${Math.round(d * 100)}%"><i></i></span><b>${num(d)}</b></div>`);
        if (cut) group++;
        groupOf.push(group);
      }
    });
    stage.innerHTML = `<div class="chunk-doc-title"><span>Условные расстояния между соседними предложениями</span><span>${fragments(group + 1)}</span></div><div class="chunk-list">${parts.join("")}</div>`;
    let text = `Граница ставится при \\(d_i&gt;${num(threshold)}\\). `;
    if (group === 0) text += "Порог выше всех расстояний: весь документ — один фрагмент, и блокировка входа смешана с восстановлением доступа.";
    else if (groupOf[EVID] !== groupOf[CORP]) text += "Предложение о корпоративных аккаунтах отделилось от инструкции, к которой относится его «запрос»: для ответа понадобится соседний фрагмент.";
    else if (groupOf[COND] === groupOf[EVID]) text += "Условие, обе инструкции и примечание о корпоративных аккаунтах — в одном фрагменте; отделилась только блокировка входа. Фрагмент смешивает два способа восстановления, и его вектор — компромисс между ними.";
    else text += "Инструкция и примечание о корпоративных аккаунтах вместе, а условие «доступа к почте нет» ушло в предыдущий фрагмент.";
    say.innerHTML = text;
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
    event.target.nextElementSibling.value = num(threshold);
    draw();
  });
  draw();
}

Object.assign(FIGURES, {
  "chunk-strategies": mountChunkStrategies
});

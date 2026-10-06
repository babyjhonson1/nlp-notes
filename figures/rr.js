/* Иллюстрация раздела rag/reranking: три архитектуры на одной паре и расчёт MaxSim. */

function mountRrArch(box){
  const QUERY = ["забыл", "пароль", "почта", "не открывается"];
  // Демонстрационные числа из текста раздела: косинусы bi-encoder из rag/dense-retrieval,
  // косинусы токенов для MaxSim, условные оценки cross-encoder.
  const DOCS = {
    recovery: {
      title: "Восстановление доступа",
      text: "Если вы не помните пароль, а привязанный электронный ящик недоступен, подтвердите личность через форму поддержки по номеру телефона из профиля.",
      tokens: ["не помните", "пароль", "ящик", "недоступен", "форма", "поддержки", "телефон"],
      sim: [
        [0.82, 0.44, 0.10, 0.38, 0.05, 0.08, 0.02],
        [0.40, 0.95, 0.22, 0.18, 0.12, 0.15, 0.09],
        [0.12, 0.28, 0.71, 0.30, 0.10, 0.14, 0.25],
        [0.35, 0.16, 0.33, 0.78, 0.07, 0.11, 0.04]
      ],
      cos: 0.72,
      cross: 4.9
    },
    change: {
      title: "Смена пароля",
      text: "Чтобы сменить пароль, откройте настройки профиля и перейдите по ссылке из письма, которое придёт на вашу почту.",
      tokens: ["сменить", "пароль", "настройки", "профиля", "ссылка", "письмо", "почту"],
      sim: [
        [0.41, 0.40, 0.05, 0.03, 0.12, 0.08, 0.10],
        [0.30, 0.94, 0.12, 0.14, 0.20, 0.15, 0.18],
        [0.09, 0.25, 0.08, 0.15, 0.30, 0.74, 0.93],
        [0.21, 0.12, 0.10, 0.06, 0.34, 0.22, 0.29]
      ],
      cos: 0.68,
      cross: -1.3
    }
  };
  const MODES = {
    bi: "Bi-encoder",
    late: "Late interaction",
    cross: "Cross-encoder"
  };
  const COST = {
    bi: ["один вектор чанка", "одно скалярное произведение", "\\(m\\) чисел на чанк"],
    late: ["вектор каждого токена", "\\(|q|\\cdot|d|\\) скалярных произведений", "\\(|d|\\cdot m\\) чисел на чанк"],
    cross: ["ничего", "прогон модели по \\(|q|+|d|\\) токенам", "только текст"]
  };
  let mode = "late";
  let doc = "recovery";

  box.innerHTML = `
    <div class="fig-stage rr-stage">
      <div class="rr-query"><span>запрос</span><b>${QUERY.join(" ").replace("пароль почта", "пароль, почта")}</b></div>
      <div class="rr-body"></div>
      <div class="rr-cost">
        <div><span>заранее</span><b data-cost="0"></b></div>
        <div><span>на кандидата при запросе</span><b data-cost="1"></b></div>
        <div><span>хранение</span><b data-cost="2"></b></div>
      </div>
    </div>
    <div class="fig-row">
      <div class="fig-tabs" role="tablist" aria-label="Архитектура">
        ${Object.entries(MODES).map(([key, label]) => `<button type="button" role="tab" data-mode="${key}">${label}</button>`).join("")}
      </div>
      <span class="spacer"></span>
      <div class="fig-tabs" role="tablist" aria-label="Документ">
        ${Object.entries(DOCS).map(([key, d]) => `<button type="button" role="tab" data-doc="${key}">${d.title}</button>`).join("")}
      </div>
    </div>
    <p class="fig-say"></p>
    <div class="fig-legend"></div>`;

  const body = box.querySelector(".rr-body");
  const say = box.querySelector(".fig-say");
  const legendBox = box.querySelector(".fig-legend");
  const costCells = [...box.querySelectorAll("[data-cost]")];
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const num = (x) => x.toFixed(2).replace(".", ",").replace("-", "−");
  const vec = (seed) => {
    const r = rng(seed);
    return `<span class="rr-vec" aria-hidden="true">${Array.from({ length: 8 }, () => `<i style="opacity:${(0.2 + 0.8 * r()).toFixed(2)}"></i>`).join("")}</span>`;
  };
  const maxsim = (d) => d.sim.reduce((sum, row) => sum + Math.max(...row), 0);

  function biView(d){
    body.innerHTML = `
      <div class="rr-line"><span class="rr-role">запрос</span><span class="rr-text">${esc(QUERY.join(" "))}</span><span class="rr-to">→</span>${vec(3)}<span class="rr-tag">при запросе</span></div>
      <div class="rr-line"><span class="rr-role">документ</span><span class="rr-text">${esc(d.text)}</span><span class="rr-to">→</span>${vec(doc === "recovery" ? 11 : 17)}<span class="rr-tag pre">заранее</span></div>
      <div class="rr-score">косинус двух векторов: <b>${num(d.cos)}</b></div>`;
    say.innerHTML = `Вектор документа вычислен до запроса и один на все возможные вопросы к нему. Оценки двух документов — \\(0{,}72\\) и \\(0{,}68\\): порядок верный, но разрыв мал, потому что оба документа «о пароле и почте».`;
    legendBox.innerHTML = `<span><i class="rr-key pre"></i>вычисляется при индексации</span>`;
  }

  function lateView(d){
    const maxes = d.sim.map((row) => Math.max(...row));
    const head = `<div class="rr-cell rr-corner"></div>${d.tokens.map((t) => `<div class="rr-cell rr-colhead">${esc(t)}</div>`).join("")}<div class="rr-cell rr-colhead rr-maxhead">max</div>`;
    const rows = d.sim.map((row, i) => {
      const j = row.indexOf(maxes[i]);
      return `<div class="rr-cell rr-rowhead">${esc(QUERY[i])}</div>${row.map((v, c) => `<div class="rr-cell rr-v${c === j ? " rr-best" : ""}" style="--v:${Math.max(0, v).toFixed(2)}">${num(v)}</div>`).join("")}<div class="rr-cell rr-max">${num(maxes[i])}</div>`;
    }).join("");
    body.innerHTML = `
      <div class="rr-grid-wrap"><div class="rr-grid" style="--cols:${d.tokens.length}">${head}${rows}</div></div>
      <div class="rr-score">MaxSim: \\(${maxes.map((m) => num(m).replace(",", "{,}")).join("+")}=${num(maxsim(d)).replace(",", "{,}")}\\)</div>`;
    const other = DOCS[doc === "recovery" ? "change" : "recovery"];
    say.innerHTML = doc === "recovery"
      ? `Каждый токен запроса ищет свой лучший токен документа. «Не открывается» находит «недоступен» (\\(0{,}78\\)), «почта» — «ящик». Сумма \\(${num(maxsim(d)).replace(",", "{,}")}\\) против \\(${num(maxsim(other)).replace(",", "{,}")}\\) у «Смены пароля».`
      : `«Почта» здесь находит само слово «почту» (\\(0{,}93\\)), но для «не открывается» соответствия нет: лучший токен — «ссылка» с \\(0{,}34\\). Сумма \\(${num(maxsim(d)).replace(",", "{,}")}\\) против \\(${num(maxsim(other)).replace(",", "{,}")}\\) у «Восстановления доступа».`;
    legendBox.innerHTML = `<span><i class="rr-key heat"></i>косинус токенов (демонстрационный)</span><span><i class="rr-key best"></i>максимум строки</span><span><i class="rr-key pre"></i>векторы токенов документа считаются заранее</span>`;
  }

  function crossView(d){
    const q = QUERY.map((t) => `<span class="rr-tok q">${esc(t)}</span>`).join("");
    const dt = d.tokens.map((t) => `<span class="rr-tok d">${esc(t)}</span>`).join("");
    body.innerHTML = `
      <div class="rr-seq"><span class="rr-tok sp">[CLS]</span>${q}<span class="rr-tok sp">[SEP]</span>${dt}<span class="rr-tok sp">…</span><span class="rr-tok sp">[SEP]</span></div>
      <div class="rr-attn">Внимание на каждом слое связывает все пары токенов, например «не открывается» ↔ «${esc(doc === "recovery" ? "недоступен" : "почту")}». Голова над [CLS] выдаёт одно число.</div>
      <div class="rr-score">оценка пары (условная): <b>${num(d.cross)}</b></div>`;
    say.innerHTML = `Запрос и документ проходят через модель вместе, поэтому ничего нельзя вычислить заранее: на каждого кандидата — отдельный прогон. Условные оценки \\(4{,}9\\) и \\(-1{,}3\\) разводят документы сильнее всего, но это логиты другой модели, и их шкалу нельзя сравнивать с косинусами или суммой MaxSim.`;
    legendBox.innerHTML = `<span><i class="rr-key q"></i>токены запроса</span><span><i class="rr-key d"></i>токены документа</span>`;
  }

  function draw(){
    box.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.mode === mode)));
    box.querySelectorAll("[data-doc]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.doc === doc)));
    const d = DOCS[doc];
    if (mode === "bi") biView(d);
    else if (mode === "late") lateView(d);
    else crossView(d);
    costCells.forEach((cell, i) => { cell.innerHTML = COST[mode][i]; });
    if (typeof typesetMath === "function") typesetMath([body, ...costCells]);
  }

  box.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => { mode = b.dataset.mode; draw(); }));
  box.querySelectorAll("[data-doc]").forEach((b) => b.addEventListener("click", () => { doc = b.dataset.doc; draw(); }));
  draw();
}

Object.assign(FIGURES, {
  "rr-arch": mountRrArch
});

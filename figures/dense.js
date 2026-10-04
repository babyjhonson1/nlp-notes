/* Иллюстрация раздела rag/dense-retrieval: контрастивная функция потерь, температура и выбор негативов. */

function mountDenseInfonce(box){
  // Демонстрационные косинусы из примера в тексте раздела.
  const candidates = [
    { key: "pos", title: "Восстановление доступа", s: 0.72, role: "pos", roleText: "позитив" },
    { key: "faq", title: "FAQ: нет доступа к почте", s: 0.70, role: "false", roleText: "ложный негатив" },
    { key: "change", title: "Смена пароля", s: 0.68, role: "hard", roleText: "трудный негатив" },
    { key: "twofa", title: "Двухфакторная аутентификация", s: 0.41, role: "easy", roleText: "случайный негатив" },
    { key: "tariffs", title: "Тарифы и оплата", s: 0.12, role: "easy", roleText: "случайный негатив" }
  ];
  const modes = {
    easy: { label: "Случайные негативы", keys: ["pos", "twofa", "tariffs"] },
    hard: { label: "+ трудный", keys: ["pos", "change", "twofa", "tariffs"] },
    false: { label: "+ ложный", keys: ["pos", "faq", "change", "twofa", "tariffs"] }
  };
  const taus = [0.02, 0.03, 0.05, 0.07, 0.1, 0.2, 0.5, 1];
  let mode = "hard";
  let tauIndex = taus.indexOf(0.05);

  box.innerHTML = `
    <div class="fig-stage dense-stage">
      <div class="dense-query">
        <span>запрос</span><b>забыл пароль, почта не открывается</b>
        <small>потери \\(\\mathcal{L}\\): <output class="dense-loss"></output></small>
      </div>
      <div class="dense-head" aria-hidden="true">
        <span class="dense-c-title">кандидат</span>
        <span class="dense-c-s">\\(s\\)</span>
        <span class="dense-c-p">вероятность \\(p\\)</span>
        <span class="dense-c-g">сдвиг оценки \\(-\\partial\\mathcal{L}/\\partial s\\)</span>
      </div>
      <div class="dense-rows" aria-live="polite"></div>
    </div>
    <div class="fig-row">
      <div class="fig-tabs" role="tablist" aria-label="Набор негативов">
        ${Object.entries(modes).map(([key, m]) => `<button type="button" role="tab" data-mode="${key}" aria-selected="${key === mode}">${m.label}</button>`).join("")}
      </div>
      <span class="spacer"></span>
      <label class="fig-range"><span>\\(\\tau\\)</span><input type="range" min="0" max="${taus.length - 1}" step="1" value="${tauIndex}" data-range="tau"><output></output></label>
    </div>
    <p class="fig-say"></p>
    <div class="fig-legend">
      <span><i class="dense-key pos"></i>позитив</span>
      <span><i class="dense-key hard"></i>трудный негатив</span>
      <span><i class="dense-key easy"></i>случайный негатив</span>
      <span><i class="dense-key false"></i>релевантный документ, размеченный как негатив</span>
    </div>`;

  const rowsBox = box.querySelector(".dense-rows");
  const lossOut = box.querySelector(".dense-loss");
  const tauInput = box.querySelector('[data-range="tau"]');
  const tauOut = tauInput.nextElementSibling;
  const say = box.querySelector(".fig-say");
  const fmt = (value, digits) => value.toLocaleString("ru-RU", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const small = (value, digits) => value > 0 && value < Math.pow(10, -digits) ? "&lt;" + fmt(Math.pow(10, -digits), digits) : fmt(value, digits);

  function calculate(){
    const tau = taus[tauIndex];
    const rows = modes[mode].keys.map((key) => candidates.find((c) => c.key === key));
    const logits = rows.map((r) => r.s / tau);
    const max = Math.max(...logits);
    const weights = logits.map((z) => Math.exp(z - max));
    const total = weights.reduce((a, w) => a + w, 0);
    const result = rows.map((r, i) => {
      const p = weights[i] / total;
      const grad = (p - (r.role === "pos" ? 1 : 0)) / tau;
      return { ...r, p, grad };
    });
    const loss = -Math.log(result[0].p);
    return { tau, rows: result, loss };
  }

  function explanation({ tau, rows, loss }){
    const by = (key) => rows.find((r) => r.key === key);
    const pos = by("pos");
    let text;
    if (mode === "easy"){
      text = `Остались только случайные негативы. Позитив получает вероятность ${small(pos.p, 3)}, потери ${small(loss, 3)}.`;
      if (loss < 0.05) text += " Градиент почти нулевой: шаг обучения почти ничего не меняет, и отличать «Смену пароля» модель не учится.";
    } else if (mode === "hard"){
      const change = by("change"), tariffs = by("tariffs");
      text = `«Смену пароля» сдвигают вниз с силой ${small(change.grad, 2)}, «Тарифы» — с силой ${small(tariffs.grad, 2)}.`;
      if (change.grad > 10 * tariffs.grad) text += " Обучение сосредоточено на близком документе, который модель действительно может спутать с ответом.";
    } else {
      const faq = by("faq"), change = by("change");
      const than = small(faq.grad, 2) === small(change.grad, 2) ? "так же сильно, как" : "сильнее, чем";
      text = `FAQ тоже отвечает на вопрос, но размечен как негатив. Его сдвигают вниз с силой ${small(faq.grad, 2)} — ${than} настоящий трудный негатив (${small(change.grad, 2)}). Модель учат подавлять правильный ответ.`;
    }
    if (tau >= 0.5) text += " При большой температуре вероятности почти равны: даже при правильном порядке потери велики, а сдвиг распределён между всеми негативами.";
    else if (tau <= 0.03) text += " При малой температуре обучение реагирует почти только на ближайший негатив.";
    return text;
  }

  function draw(){
    const state = calculate();
    const maxGrad = Math.max(...state.rows.map((r) => Math.abs(r.grad)));
    rowsBox.innerHTML = state.rows.map((r) => {
      const gWidth = maxGrad > 0 ? 100 * Math.abs(r.grad) / maxGrad : 0;
      const arrow = r.grad < 0 ? "↑" : "↓";
      return `<div class="dense-row ${r.role}" aria-label="${r.title}, ${r.roleText}: вероятность ${fmt(r.p, 3)}, сдвиг оценки ${r.grad < 0 ? "вверх" : "вниз"} ${fmt(Math.abs(r.grad), 2)}">
        <div class="dense-c-title"><b>${r.title}</b><small>${r.roleText}</small></div>
        <span class="dense-c-s">${fmt(r.s, 2)}</span>
        <div class="dense-c-p dense-cell"><div class="dense-meter"><i style="width:${100 * r.p}%"></i></div><span>${small(r.p, 3)}</span></div>
        <div class="dense-c-g dense-cell"><div class="dense-meter"><i style="width:${gWidth}%"></i></div><span>${arrow} ${small(Math.abs(r.grad), 2)}</span></div>
      </div>`;
    }).join("");
    lossOut.value = fmt(state.loss, 3);
    tauOut.value = fmt(state.tau, state.tau < 0.1 ? 2 : state.tau < 1 ? 1 : 0);
    say.innerHTML = explanation(state);
  }

  box.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      mode = button.dataset.mode;
      box.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-selected", String(b === button)));
      draw();
    });
  });
  tauInput.addEventListener("input", () => {
    tauIndex = Number(tauInput.value);
    draw();
  });
  draw();
}

Object.assign(FIGURES, {
  "dense-infonce": mountDenseInfonce
});
